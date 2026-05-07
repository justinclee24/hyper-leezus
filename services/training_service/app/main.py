from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import mlflow
import optuna
from fastapi import FastAPI

from ml.training.pipeline import TrainingOrchestrator
from services.db import init_db
from services.shared import logger, settings

app = FastAPI(title="training-service", version="0.1.0")
if settings.mlflow_tracking_uri:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)


def objective(trial: optuna.Trial) -> float:
    learning_rate = trial.suggest_float("learning_rate", 0.01, 0.3, log=True)
    max_depth = trial.suggest_int("max_depth", 3, 10)
    n_estimators = trial.suggest_int("n_estimators", 100, 320, step=20)
    return 1 / (learning_rate * max_depth * n_estimators)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/train/run")
async def train(payload: dict[str, Any]) -> dict[str, Any]:
    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=int(payload.get("n_trials", 12)))
    orchestrator = TrainingOrchestrator()
    artifact = orchestrator.train_all(payload.get("league", "nba"), study.best_params)
    logger.info("training_completed", artifact=artifact)
    return {
        "trained_at": datetime.now(timezone.utc),
        "best_params": study.best_params,
        "artifact": artifact,
    }


@app.on_event("startup")
async def startup() -> None:
    init_db()
