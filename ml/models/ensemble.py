from __future__ import annotations

from dataclasses import dataclass

from services.prediction_api.app.api.schemas import PredictionRequest
from services.shared import PredictionResponse


@dataclass
class StubModelBundle:
    league: str
    version: str

    def predict(self, request: PredictionRequest) -> PredictionResponse:
        base = request.features.get("power_rating_diff", 0.0)
        market = request.features.get("market_implied_home", 0.5)
        blended = max(0.05, min(0.95, 0.5 + (base * 0.04) + (market - 0.5) * 0.6))
        total = request.features.get("projected_total", 218.5)
        spread = round((blended - 0.5) * 14, 2)
        return PredictionResponse(
            game_id=request.context.game_id,
            league=request.context.league,
            win_probability_home=round(blended, 4),
            predicted_home_score=round((total / 2) + (spread / 2), 1),
            predicted_away_score=round((total / 2) - (spread / 2), 1),
            spread_home=spread,
            total_points=total,
            confidence=min(0.99, abs(blended - 0.5) * 1.8 + 0.5),
            model_version=self.version,
            explanation={
                "top_features": [
                    {"feature": "power_rating_diff", "impact": round(base * 0.3, 4)},
                    {"feature": "market_implied_home", "impact": round((market - 0.5) * 0.2, 4)},
                    {"feature": "rest_days_diff", "impact": request.features.get("rest_days_diff", 0.0)},
                ],
                "stack": {
                    "xgboost": round(blended - 0.01, 4),
                    "lightgbm": round(blended + 0.01, 4),
                    "lstm": round(blended, 4),
                    "bayesian": round(blended - 0.005, 4),
                    "gnn": round(blended + 0.005, 4),
                },
            },
        )
