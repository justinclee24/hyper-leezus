from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TeamStatRecord(BaseModel):
    provider: str
    league: str
    external_game_id: str
    team_id: str
    team_name: str
    opponent_id: str
    opponent_name: str
    is_home: bool
    game_date: datetime
    points_for: float
    points_against: float
    possessions: float = Field(default=100.0)
    minutes: float = Field(default=48.0)
    home_win_pct: float = Field(default=0.5)
    away_win_pct: float = Field(default=0.5)
    rest_days: int = Field(default=2)
    prev_lat: float = Field(default=39.7392)
    prev_lon: float = Field(default=-104.9903)
    venue_lat: float = Field(default=39.7392)
    venue_lon: float = Field(default=-104.9903)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PlayerStatRecord(BaseModel):
    provider: str
    league: str
    external_game_id: str
    player_id: str
    player_name: str
    team_id: str
    minutes: float
    usage_rate: float
    efficiency_rating: float
    lineup_synergy: float = 0.0
    injury_status: str = "active"
    metadata: dict[str, Any] = Field(default_factory=dict)


class OddsRecord(BaseModel):
    provider: str
    league: str
    external_game_id: str
    sportsbook: str
    home_moneyline: float
    away_moneyline: float
    spread_home: float
    total: float
    implied_probability_home: float
    line_movement: float = 0.0
    public_betting_pct: float = 0.5
    sharp_betting_pct: float = 0.5
    collected_at: datetime


class InjuryReportRecord(BaseModel):
    provider: str
    league: str
    player_id: str
    team_id: str
    status: str
    impact_score: float = 0.0
    collected_at: datetime


class SentimentRecord(BaseModel):
    provider: str
    league: str
    subject_id: str
    subject_type: str
    sentiment_score: float
    volume: int
    collected_at: datetime


class WeatherRecord(BaseModel):
    provider: str
    league: str
    external_game_id: str
    temperature_f: float
    wind_mph: float
    precipitation_pct: float
    collected_at: datetime


class NormalizedIngestionBatch(BaseModel):
    source: str
    collected_at: datetime
    team_stats: list[TeamStatRecord] = Field(default_factory=list)
    player_stats: list[PlayerStatRecord] = Field(default_factory=list)
    odds: list[OddsRecord] = Field(default_factory=list)
    injuries: list[InjuryReportRecord] = Field(default_factory=list)
    sentiment: list[SentimentRecord] = Field(default_factory=list)
    weather: list[WeatherRecord] = Field(default_factory=list)
    raw_payload: dict[str, Any]
