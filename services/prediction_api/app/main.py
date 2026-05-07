from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlalchemy import desc, select

from ml.training.registry import RegistryClient
from services.db import init_db, session_scope
from services.prediction_api.app.api.schemas import PredictionRequest
from services.repositories import TrainingRepository
from services.shared import PredictionResponse, settings

app = FastAPI(title="prediction-api", version="0.1.0")
bearer = HTTPBearer(auto_error=False)
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


def rate_limit_exceeded_handler(request, exc):
    return {"detail": "Rate limit exceeded"}


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

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


@app.get("/model/info")
async def model_info() -> dict:
    from services.models import ModelTrainingRun

    leagues = ["nba", "nhl", "mlb", "nfl", "ncaab"]
    results = {}
    try:
        with session_scope() as session:
            for league in leagues:
                row = session.execute(
                    select(ModelTrainingRun)
                    .where(ModelTrainingRun.league == league)
                    .order_by(desc(ModelTrainingRun.created_at))
                    .limit(1)
                ).scalar_one_or_none()
                if row:
                    results[league] = {
                        "version": row.model_version,
                        "metrics": row.metrics_json,
                        "training_rows": row.params_json.get("training_rows", 0),
                        "trained_at": row.created_at.isoformat() if row.created_at else None,
                        "is_real": row.model_blob is not None,
                    }
    except Exception:
        pass
    return {"models": results, "leagues": leagues}


@app.on_event("startup")
async def startup() -> None:
    init_db()
