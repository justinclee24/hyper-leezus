from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from ml.training.registry import RegistryClient
from services.db import init_db, session_scope
from services.prediction_api.app.api.schemas import PredictionRequest
from services.repositories import TrainingRepository
from services.shared import PredictionResponse, settings

app = FastAPI(title="prediction-api", version="0.1.0")
bearer = HTTPBearer(auto_error=False)
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, limiter._rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

registry = RegistryClient()


def require_auth(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return credentials.credentials


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model_stage": settings.model_stage}


@app.post("/predict", response_model=PredictionResponse)
@limiter.limit("60/minute")
async def predict(request: PredictionRequest, _: str = Depends(require_auth)) -> PredictionResponse:
    model_bundle = registry.load_active_bundle(request.context.league)
    prediction = model_bundle.predict(request)
    with session_scope() as session:
        TrainingRepository(session).save_prediction_record(
            {
                "game_id": prediction.game_id,
                "league": prediction.league,
                "model_version": prediction.model_version,
                "win_probability_home": prediction.win_probability_home,
                "predicted_home_score": prediction.predicted_home_score,
                "predicted_away_score": prediction.predicted_away_score,
                "spread_home": prediction.spread_home,
                "total_points": prediction.total_points,
                "confidence": prediction.confidence,
                "explanation_json": prediction.explanation,
                "generated_at": prediction.generated_at,
            }
        )
    return prediction


@app.on_event("startup")
async def startup() -> None:
    init_db()
