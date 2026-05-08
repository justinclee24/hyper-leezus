from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.metrics import accuracy_score, log_loss, mean_squared_error
from sklearn.model_selection import train_test_split

from ml.training.datasets import TRAINING_FEATURES
from ml.training.league_configs import LeagueTrainingProfile

try:
    from xgboost import XGBClassifier, XGBRegressor
except Exception:  # pragma: no cover - optional dependency fallback
    XGBClassifier = None
    XGBRegressor = None


@dataclass
class TrainedLeagueBundle:
    profile: LeagueTrainingProfile
    version: str
    feature_names: list[str]
    metrics: dict[str, float]
    artifact_path: str


class LeagueTrainer:
    def __init__(self, artifact_root: str = "artifacts/models") -> None:
        self.artifact_root = Path(artifact_root)
        self.artifact_root.mkdir(parents=True, exist_ok=True)

    def train(self, frame: pd.DataFrame, profile: LeagueTrainingProfile, version: str, params: dict[str, Any]) -> TrainedLeagueBundle:
        if len(frame) < 20:
            raise ValueError(f"Training frame for {profile.league} is too small: {len(frame)} rows")

        features = frame[TRAINING_FEATURES]
        y_class = frame["home_win"]
        y_home = frame["home_score"]
        y_away = frame["away_score"]

        # Time-ordered split — train on oldest 75%, evaluate on most recent 25%
        split = int(len(frame) * 0.75)
        X_train = features.iloc[:split]
        X_test = features.iloc[split:]
        y_class_train = y_class.iloc[:split]
        y_class_test = y_class.iloc[split:]
        y_home_train = y_home.iloc[:split]
        y_home_test = y_home.iloc[split:]
        y_away_train = y_away.iloc[:split]
        y_away_test = y_away.iloc[split:]

        # Build and calibrate the win-probability classifier
        base_clf = self._build_classifier(params, y_class_train.nunique())
        if XGBClassifier is not None and isinstance(base_clf, XGBClassifier):
            base_clf.fit(
                X_train, y_class_train,
                eval_set=[(X_test, y_class_test)],
                verbose=False,
            )
        else:
            base_clf.fit(X_train, y_class_train)

        # Sigmoid (Platt) calibration — improves probability estimates, works well
        # even with small datasets where isotonic regression would overfit.
        if not isinstance(base_clf, DummyClassifier):
            classifier = CalibratedClassifierCV(base_clf, method="sigmoid", cv="prefit")
            classifier.fit(X_test, y_class_test)
        else:
            classifier = base_clf

        home_regressor = self._build_regressor(params)
        away_regressor = self._build_regressor(params)
        home_regressor.fit(X_train, y_home_train)
        away_regressor.fit(X_train, y_away_train)

        class_proba = self._positive_class_probability(classifier, X_test)
        home_pred = home_regressor.predict(X_test)
        away_pred = away_regressor.predict(X_test)

        ece = self._compute_ece(class_proba, y_class_test.to_numpy())
        accuracy = float(accuracy_score(y_class_test, (class_proba >= 0.5).astype(int)))

        metrics = {
            "accuracy": accuracy,
            "log_loss": float(log_loss(y_class_test, class_proba, labels=[0, 1])),
            "home_rmse": float(mean_squared_error(y_home_test, home_pred) ** 0.5),
            "away_rmse": float(mean_squared_error(y_away_test, away_pred) ** 0.5),
            "brier_score": float(((class_proba - y_class_test.to_numpy()) ** 2).mean()),
            "ece": ece,
        }

        artifact = {
            "profile": profile,
            "version": version,
            "feature_names": TRAINING_FEATURES,
            "classifier": classifier,
            "home_regressor": home_regressor,
            "away_regressor": away_regressor,
        }
        artifact_path = self.artifact_root / f"{version}.pkl"
        with artifact_path.open("wb") as handle:
            pickle.dump(artifact, handle)

        return TrainedLeagueBundle(
            profile=profile,
            version=version,
            feature_names=TRAINING_FEATURES,
            metrics=metrics,
            artifact_path=str(artifact_path),
        )

    @staticmethod
    def _compute_ece(probs: Any, labels: Any, n_bins: int = 10) -> float:
        """Expected Calibration Error — how well probability estimates match empirical frequencies."""
        probs_arr = np.asarray(probs, dtype=float)
        labels_arr = np.asarray(labels, dtype=float)
        bins = np.linspace(0.0, 1.0, n_bins + 1)
        ece = 0.0
        n = len(labels_arr)
        for lo, hi in zip(bins[:-1], bins[1:]):
            mask = (probs_arr >= lo) & (probs_arr < hi)
            if mask.sum() == 0:
                continue
            bin_confidence = probs_arr[mask].mean()
            bin_accuracy = labels_arr[mask].mean()
            ece += abs(bin_confidence - bin_accuracy) * mask.sum() / n
        return float(ece)

    @staticmethod
    def _build_classifier(params: dict[str, Any], class_count: int) -> Any:
        if class_count < 2:
            return DummyClassifier(strategy="most_frequent")
        if XGBClassifier is not None:
            return XGBClassifier(
                n_estimators=int(params.get("n_estimators", 200)),
                max_depth=int(params.get("max_depth", 4)),
                learning_rate=float(params.get("learning_rate", 0.05)),
                subsample=float(params.get("subsample", 0.8)),
                colsample_bytree=float(params.get("colsample_bytree", 0.8)),
                reg_alpha=float(params.get("reg_alpha", 0.3)),
                reg_lambda=float(params.get("reg_lambda", 1.5)),
                min_child_weight=int(params.get("min_child_weight", 8)),
                gamma=float(params.get("gamma", 0.5)),
                eval_metric="logloss",
                early_stopping_rounds=20,
                random_state=42,
            )
        return RandomForestClassifier(
            n_estimators=int(params.get("n_estimators", 300)),
            max_depth=int(params.get("max_depth", 5)),
            min_samples_leaf=int(params.get("min_samples_leaf", 8)),
            random_state=42,
        )

    @staticmethod
    def _build_regressor(params: dict[str, Any]) -> Any:
        if XGBRegressor is not None:
            return XGBRegressor(
                n_estimators=int(params.get("n_estimators", 200)),
                max_depth=int(params.get("max_depth", 4)),
                learning_rate=float(params.get("learning_rate", 0.05)),
                subsample=float(params.get("subsample", 0.8)),
                colsample_bytree=float(params.get("colsample_bytree", 0.8)),
                reg_alpha=float(params.get("reg_alpha", 0.3)),
                reg_lambda=float(params.get("reg_lambda", 1.5)),
                min_child_weight=int(params.get("min_child_weight", 8)),
                random_state=42,
            )
        return GradientBoostingRegressor(
            learning_rate=float(params.get("learning_rate", 0.05)),
            max_depth=int(params.get("max_depth", 4)),
            n_estimators=int(params.get("n_estimators", 200)),
            min_samples_leaf=int(params.get("min_samples_leaf", 8)),
            subsample=0.8,
            random_state=42,
        )

    @staticmethod
    def _positive_class_probability(classifier: Any, features: pd.DataFrame) -> Any:
        probabilities = classifier.predict_proba(features)
        classes = list(getattr(classifier, "classes_", [0, 1]))
        if probabilities.shape[1] == 1:
            return probabilities[:, 0] if classes[0] == 1 else 1.0 - probabilities[:, 0]
        if 1 in classes:
            return probabilities[:, classes.index(1)]
        return probabilities[:, -1]
