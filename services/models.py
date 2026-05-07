from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from services.db import Base


class RawIngestionRecord(Base):
    __tablename__ = "raw_ingestion_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(80), index=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    s3_key: Mapped[str] = mapped_column(String(255), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)


class TeamGameStat(Base):
    __tablename__ = "team_game_stats"
    __table_args__ = (UniqueConstraint("league", "external_game_id", "team_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(80))
    league: Mapped[str] = mapped_column(String(32), index=True)
    external_game_id: Mapped[str] = mapped_column(String(120), index=True)
    team_id: Mapped[str] = mapped_column(String(120), index=True)
    team_name: Mapped[str] = mapped_column(String(120))
    opponent_id: Mapped[str] = mapped_column(String(120))
    opponent_name: Mapped[str] = mapped_column(String(120))
    is_home: Mapped[bool] = mapped_column(Boolean, index=True)
    game_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    points_for: Mapped[float] = mapped_column(Float)
    points_against: Mapped[float] = mapped_column(Float)
    possessions: Mapped[float] = mapped_column(Float)
    minutes: Mapped[float] = mapped_column(Float)
    home_win_pct: Mapped[float] = mapped_column(Float)
    away_win_pct: Mapped[float] = mapped_column(Float)
    rest_days: Mapped[int] = mapped_column(Integer)
    prev_lat: Mapped[float] = mapped_column(Float)
    prev_lon: Mapped[float] = mapped_column(Float)
    venue_lat: Mapped[float] = mapped_column(Float)
    venue_lon: Mapped[float] = mapped_column(Float)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class PlayerGameStat(Base):
    __tablename__ = "player_game_stats"
    __table_args__ = (UniqueConstraint("league", "external_game_id", "player_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(80))
    league: Mapped[str] = mapped_column(String(32), index=True)
    external_game_id: Mapped[str] = mapped_column(String(120), index=True)
    player_id: Mapped[str] = mapped_column(String(120), index=True)
    player_name: Mapped[str] = mapped_column(String(120))
    team_id: Mapped[str] = mapped_column(String(120), index=True)
    minutes: Mapped[float] = mapped_column(Float)
    usage_rate: Mapped[float] = mapped_column(Float)
    efficiency_rating: Mapped[float] = mapped_column(Float)
    lineup_synergy: Mapped[float] = mapped_column(Float)
    injury_status: Mapped[str] = mapped_column(String(64))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class MarketOdds(Base):
    __tablename__ = "market_odds"
    __table_args__ = (UniqueConstraint("league", "external_game_id", "sportsbook", "collected_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(80))
    league: Mapped[str] = mapped_column(String(32), index=True)
    external_game_id: Mapped[str] = mapped_column(String(120), index=True)
    sportsbook: Mapped[str] = mapped_column(String(80))
    home_moneyline: Mapped[float] = mapped_column(Float)
    away_moneyline: Mapped[float] = mapped_column(Float)
    spread_home: Mapped[float] = mapped_column(Float)
    total: Mapped[float] = mapped_column(Float)
    implied_probability_home: Mapped[float] = mapped_column(Float)
    line_movement: Mapped[float] = mapped_column(Float)
    public_betting_pct: Mapped[float] = mapped_column(Float)
    sharp_betting_pct: Mapped[float] = mapped_column(Float)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class InjuryReport(Base):
    __tablename__ = "injury_reports"
    __table_args__ = (UniqueConstraint("league", "player_id", "collected_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(80))
    league: Mapped[str] = mapped_column(String(32), index=True)
    player_id: Mapped[str] = mapped_column(String(120), index=True)
    team_id: Mapped[str] = mapped_column(String(120), index=True)
    status: Mapped[str] = mapped_column(String(64))
    impact_score: Mapped[float] = mapped_column(Float)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class SentimentSignal(Base):
    __tablename__ = "sentiment_signals"
    __table_args__ = (UniqueConstraint("league", "subject_id", "subject_type", "collected_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(80))
    league: Mapped[str] = mapped_column(String(32), index=True)
    subject_id: Mapped[str] = mapped_column(String(120), index=True)
    subject_type: Mapped[str] = mapped_column(String(32))
    sentiment_score: Mapped[float] = mapped_column(Float)
    volume: Mapped[int] = mapped_column(Integer)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"
    __table_args__ = (UniqueConstraint("league", "external_game_id", "collected_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(80))
    league: Mapped[str] = mapped_column(String(32), index=True)
    external_game_id: Mapped[str] = mapped_column(String(120), index=True)
    temperature_f: Mapped[float] = mapped_column(Float)
    wind_mph: Mapped[float] = mapped_column(Float)
    precipitation_pct: Mapped[float] = mapped_column(Float)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class ModelTrainingRun(Base):
    __tablename__ = "model_training_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    league: Mapped[str] = mapped_column(String(32), index=True)
    model_version: Mapped[str] = mapped_column(String(120), index=True)
    training_window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    training_window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    metrics_json: Mapped[dict] = mapped_column(JSON)
    params_json: Mapped[dict] = mapped_column(JSON)
    artifact_uri: Mapped[str] = mapped_column(Text)
    model_blob: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    game_id: Mapped[str] = mapped_column(String(120), index=True)
    league: Mapped[str] = mapped_column(String(32), index=True)
    model_version: Mapped[str] = mapped_column(String(120), index=True)
    win_probability_home: Mapped[float] = mapped_column(Float)
    predicted_home_score: Mapped[float] = mapped_column(Float)
    predicted_away_score: Mapped[float] = mapped_column(Float)
    spread_home: Mapped[float] = mapped_column(Float)
    total_points: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    explanation_json: Mapped[dict] = mapped_column(JSON)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
