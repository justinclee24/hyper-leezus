from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import mlflow
import numpy as np
import optuna
from fastapi import FastAPI

from ml.training.pipeline import TrainingOrchestrator
from services.db import init_db
from services.shared import logger, settings

optuna.logging.set_verbosity(optuna.logging.WARNING)

app = FastAPI(title="training-service", version="0.1.0")
if settings.mlflow_tracking_uri:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)


def make_objective(league: str):
    """Return a data-aware Optuna objective for the given league.

    Loads the dataset once, then evaluates each trial via time-series cross-
    validation so hyperparameters are tuned against actual predictive performance
    rather than an arbitrary formula.
    """
    from ml.training.datasets import DatasetBuilder, TRAINING_FEATURES
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import log_loss as sk_log_loss

    try:
        frame = DatasetBuilder().build(league)
    except Exception:
        frame = None

    try:
        from xgboost import XGBClassifier as _XGB
    except Exception:
        _XGB = None

    def objective(trial: optuna.Trial) -> float:
        params = {
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
            "max_depth": trial.suggest_int("max_depth", 3, 6),
            "n_estimators": trial.suggest_int("n_estimators", 100, 400, step=50),
            "subsample": trial.suggest_float("subsample", 0.6, 0.95),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 0.95),
            "min_child_weight": trial.suggest_int("min_child_weight", 4, 20),
            "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 2.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 4.0),
            "gamma": trial.suggest_float("gamma", 0.0, 1.5),
        }

        if frame is None or len(frame) < 40:
            return 0.693  # log_loss of a random 50/50 classifier — signal to use defaults

        X = frame[TRAINING_FEATURES].values
        y = frame["home_win"].values

        try:
            if _XGB is not None:
                clf = _XGB(
                    **params,
                    eval_metric="logloss",
                    random_state=42,
                    verbosity=0,
                )
            else:
                from sklearn.ensemble import RandomForestClassifier
                clf = RandomForestClassifier(
                    n_estimators=params["n_estimators"],
                    max_depth=params["max_depth"],
                    min_samples_leaf=params["min_child_weight"],
                    random_state=42,
                )

            # 3-fold time-series CV preserves temporal order (no future leakage)
            tscv = TimeSeriesSplit(n_splits=3)
            scores: list[float] = []
            for train_idx, val_idx in tscv.split(X):
                clf.fit(X[train_idx], y[train_idx])
                proba = clf.predict_proba(X[val_idx])
                classes = list(getattr(clf, "classes_", [0, 1]))
                if proba.shape[1] == 1:
                    proba_pos = proba[:, 0] if classes[0] == 1 else 1.0 - proba[:, 0]
                elif 1 in classes:
                    proba_pos = proba[:, classes.index(1)]
                else:
                    proba_pos = proba[:, -1]
                scores.append(sk_log_loss(y[val_idx], proba_pos, labels=[0, 1]))
            return float(np.mean(scores))
        except Exception:
            return 1.0  # penalise failed trials

    return objective


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/train/run")
async def train(payload: dict[str, Any]) -> dict[str, Any]:
    league = payload.get("league", "nba")
    n_trials = int(payload.get("n_trials", 20))
    study = optuna.create_study(direction="minimize")
    study.optimize(make_objective(league), n_trials=n_trials)
    orchestrator = TrainingOrchestrator()
    artifact = orchestrator.train_all(league, study.best_params)
    logger.info("training_completed", artifact=artifact, best_params=study.best_params)
    return {
        "trained_at": datetime.now(timezone.utc),
        "best_params": study.best_params,
        "artifact": artifact,
    }


@app.on_event("startup")
async def startup() -> None:
    init_db()
