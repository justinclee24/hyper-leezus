from __future__ import annotations

import pickle
from pathlib import Path

from sqlalchemy import select

from ml.models.ensemble import StubModelBundle
from services.db import session_scope
from services.prediction_api.app.api.schemas import PredictionRequest
from services.shared import PredictionResponse


class TrainedModelBundle:
    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.classifier = payload["classifier"]
        self.home_regressor = payload["home_regressor"]
        self.away_regressor = payload["away_regressor"]
        self.feature_names = payload["feature_names"]
        self.version = payload["version"]

    def predict(self, request: PredictionRequest) -> PredictionResponse:
        row = [[request.features.get(feature, 0.0) for feature in self.feature_names]]
        classes = list(getattr(self.classifier, "classes_", [0, 1]))
        probabilities = self.classifier.predict_proba(row)
        if probabilities.shape[1] == 1:
            home_probability = probabilities[0, 0] if classes[0] == 1 else 1.0 - probabilities[0, 0]
        elif 1 in classes:
            home_probability = probabilities[0, classes.index(1)]
        else:
            home_probability = probabilities[0, -1]
        predicted_home_score = float(self.home_regressor.predict(row)[0])
        predicted_away_score = float(self.away_regressor.predict(row)[0])
        spread_home = predicted_away_score - predicted_home_score
        total_points = predicted_home_score + predicted_away_score
        confidence = min(0.99, 0.5 + abs(home_probability - 0.5) * 1.6)
        return PredictionResponse(
            game_id=request.context.game_id,
            league=request.context.league,
            win_probability_home=float(home_probability),
            predicted_home_score=round(predicted_home_score, 2),
            predicted_away_score=round(predicted_away_score, 2),
            spread_home=round(spread_home, 2),
            total_points=round(total_points, 2),
            confidence=round(confidence, 4),
            model_version=self.version,
            explanation={
                "top_features": [
                    {"feature": feature, "value": request.features.get(feature, 0.0)}
                    for feature in self.feature_names[:5]
                ]
            },
        )


class RegistryClient:
    def load_active_bundle(self, league: str) -> TrainedModelBundle | StubModelBundle:
        artifact_path = self._latest_artifact_path(league)
        if artifact_path is None or not artifact_path.exists():
            return StubModelBundle(league=league, version=f"{league}-production-v1")
        with artifact_path.open("rb") as handle:
            payload = pickle.load(handle)
        return TrainedModelBundle(payload)

    @staticmethod
    def _latest_artifact_path(league: str) -> Path | None:
        try:
            from services.models import ModelTrainingRun

            with session_scope() as session:
                row = session.execute(
                    select(ModelTrainingRun)
                    .where(ModelTrainingRun.league == league)
                    .order_by(ModelTrainingRun.created_at.desc())
                    .limit(1)
                )
                latest = row.scalar_one_or_none()
                if latest is not None:
                    return Path(latest.artifact_uri)
        except Exception:
            pass

        artifact_dir = Path("artifacts/models")
        candidates = sorted(artifact_dir.glob(f"{league}-*.pkl"), reverse=True)
        return candidates[0] if candidates else None
