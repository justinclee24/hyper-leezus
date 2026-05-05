from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from services.prediction_api.app.api.schemas import PredictionRequest
from services.shared import PredictionResponse


class Predictor(Protocol):
    def predict(self, request: PredictionRequest) -> PredictionResponse: ...


@dataclass
class ModelArtifact:
    league: str
    version: str
    uri: str
    metrics: dict[str, float]
