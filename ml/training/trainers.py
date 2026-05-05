from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
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

        X_train, X_test, y_class_train, y_class_test = train_test_split(
            features, y_class, test_size=0.2, shuffle=False
        )
        _, _, y_home_train, y_home_test = train_test_split(features, y_home, test_size=0.2, shuffle=False)
        _, _, y_away_train, y_away_test = train_test_split(features, y_away, test_size=0.2, shuffle=False)

        classifier = self._build_classifier(params, y_class_train.nunique())
        home_regressor = self._build_regressor(params)
        away_regressor = self._build_regressor(params)

        classifier.fit(X_train, y_class_train)
        home_regressor.fit(X_train, y_home_train)
        away_regressor.fit(X_train, y_away_train)

        class_proba = self._positive_class_probability(classifier, X_test)
        home_pred = home_regressor.predict(X_test)
        away_pred = away_regressor.predict(X_test)

        metrics = {
            "accuracy": float(accuracy_score(y_class_test, (class_proba >= 0.5).astype(int))),
            "log_loss": float(log_loss(y_class_test, class_proba, labels=[0, 1])),
            "home_rmse": float(mean_squared_error(y_home_test, home_pred) ** 0.5),
            "away_rmse": float(mean_squared_error(y_away_test, away_pred) ** 0.5),
            "brier_score": float(((class_proba - y_class_test.to_numpy()) ** 2).mean()),
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
    def _build_classifier(params: dict[str, Any], class_count: int) -> Any:
        if class_count < 2:
            return DummyClassifier(strategy="most_frequent")
        if XGBClassifier is not None:
            return XGBClassifier(
                n_estimators=int(params.get("n_estimators", 140)),
                max_depth=int(params.get("max_depth", 5)),
                learning_rate=float(params.get("learning_rate", 0.05)),
                subsample=0.9,
                colsample_bytree=0.9,
                eval_metric="logloss",
            )
        return RandomForestClassifier(
            n_estimators=int(params.get("n_estimators", 240)),
            max_depth=int(params.get("max_depth", 8)),
            random_state=42,
        )

    @staticmethod
    def _build_regressor(params: dict[str, Any]) -> Any:
        if XGBRegressor is not None:
            return XGBRegressor(
                n_estimators=int(params.get("n_estimators", 140)),
                max_depth=int(params.get("max_depth", 5)),
                learning_rate=float(params.get("learning_rate", 0.05)),
                subsample=0.9,
                colsample_bytree=0.9,
            )
        return GradientBoostingRegressor(
            learning_rate=float(params.get("learning_rate", 0.05)),
            max_depth=int(params.get("max_depth", 3)),
            n_estimators=int(params.get("n_estimators", 180)),
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
