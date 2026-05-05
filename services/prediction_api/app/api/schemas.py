from __future__ import annotations

from pydantic import BaseModel

from services.shared import GameContext


class PredictionRequest(BaseModel):
    context: GameContext
    features: dict[str, float]
    include_explanations: bool = True
