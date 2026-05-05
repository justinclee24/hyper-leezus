from __future__ import annotations

from datetime import timedelta

from feast import Entity, FeatureService, FeatureView, Field, FileSource
from feast.types import Float32, Int64, String

game_stats_source = FileSource(
    path="data/offline/game_features.parquet",
    timestamp_field="event_timestamp",
)

game = Entity(name="game_id", join_keys=["game_id"])
team = Entity(name="team_id", join_keys=["team_id"])
player = Entity(name="player_id", join_keys=["player_id"])

team_feature_view = FeatureView(
    name="team_features",
    entities=[game, team],
    ttl=timedelta(days=30),
    schema=[
        Field(name="offensive_rating", dtype=Float32),
        Field(name="defensive_rating", dtype=Float32),
        Field(name="pace", dtype=Float32),
        Field(name="efficiency_diff", dtype=Float32),
        Field(name="travel_fatigue", dtype=Float32),
        Field(name="rest_days", dtype=Int64),
        Field(name="league", dtype=String),
    ],
    source=game_stats_source,
)

player_feature_view = FeatureView(
    name="player_features",
    entities=[game, player],
    ttl=timedelta(days=14),
    schema=[
        Field(name="usage_rate", dtype=Float32),
        Field(name="player_efficiency_rating", dtype=Float32),
        Field(name="lineup_synergy", dtype=Float32),
        Field(name="injury_adjusted_lineup_strength", dtype=Float32),
    ],
    source=game_stats_source,
)

market_feature_view = FeatureView(
    name="market_features",
    entities=[game],
    ttl=timedelta(days=7),
    schema=[
        Field(name="line_movement", dtype=Float32),
        Field(name="implied_probability_home", dtype=Float32),
        Field(name="public_betting_pct", dtype=Float32),
        Field(name="sharp_betting_pct", dtype=Float32),
        Field(name="social_sentiment", dtype=Float32),
    ],
    source=game_stats_source,
)

online_prediction_features = FeatureService(
    name="online_prediction_features",
    features=[team_feature_view, player_feature_view, market_feature_view],
)
