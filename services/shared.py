from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import jwt
import structlog
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "dev"
    postgres_dsn: str = "postgresql+psycopg://postgres:postgres@localhost:5432/hyper_leezus"
    redis_url: str = "redis://localhost:6379/0"
    kafka_bootstrap_servers: str = "localhost:9092"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minio"
    s3_secret_key: str = "minio123"
    s3_bucket: str = "hyper-leezus-data"
    mlflow_tracking_uri: str = "http://localhost:5000"
    model_stage: str = "Production"
    jwt_secret: str = "change-me"
    sports_api_key: str = ""
    odds_api_key: str = ""
    social_api_key: str = ""
    weather_api_key: str = ""
    sportradar_api_key: str = ""
    sportradar_access_level: str = "trial"
    sportradar_language_code: str = "en"
    sportradar_rugby_package: str = "union"
    sportradar_enabled_leagues: str = "nfl"
    odds_api_regions: str = "us"
    odds_api_markets: str = "h2h,spreads,totals"
    reddit_access_token: str = ""
    reddit_user_agent: str = "hyper-leezus/0.1"
    social_search_terms_json: str = '["nba","nfl","nhl","mlb","march madness","college football","premier league","rugby union"]'
    weather_locations_json: str = '[{"league":"nfl","external_game_id":"nfl-weather-den","lat":39.7439,"lon":-105.0201}]'
    weather_units: str = "imperial"
    nfl_season_year: int = 2026
    nfl_season_type: str = "REG"
    nfl_week: int = 1
    ncaaf_season_year: int = 2026
    ncaaf_season_type: str = "REG"
    ncaaf_week: int = 1


settings = Settings()
logger = structlog.get_logger("hyper-leezus")


class GameContext(BaseModel):
    league: str
    game_id: str
    home_team: str
    away_team: str
    start_time: datetime
    neutral_site: bool = False
    is_playoff: bool = False


class PredictionResponse(BaseModel):
    game_id: str
    league: str
    win_probability_home: float = Field(ge=0, le=1)
    predicted_home_score: float
    predicted_away_score: float
    spread_home: float
    total_points: float
    confidence: float = Field(ge=0, le=1)
    model_version: str
    explanation: dict[str, Any]
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def build_jwt(subject: str, role: str = "viewer") -> str:
    return jwt.encode({"sub": subject, "role": role}, settings.jwt_secret, algorithm="HS256")


@dataclass
class DataSource:
    name: str
    endpoint: str
    cadence_minutes: int
    enabled: bool = True
