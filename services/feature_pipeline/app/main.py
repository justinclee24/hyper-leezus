from __future__ import annotations

from datetime import datetime, timezone
from math import atan2, cos, radians, sin, sqrt
from typing import Any

import polars as pl
from fastapi import FastAPI

from services.shared import logger

app = FastAPI(title="feature-pipeline-service", version="0.1.0")


def haversine_distance_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_miles = 3958.8
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * radius_miles * atan2(sqrt(a), sqrt(1 - a))


def build_team_features(games: list[dict[str, Any]]) -> list[dict[str, Any]]:
    frame = pl.DataFrame(games)
    if frame.is_empty():
        return []
    engineered = frame.with_columns(
        [
            (pl.col("points_for") / pl.col("possessions")).alias("offensive_rating"),
            (pl.col("points_against") / pl.col("possessions")).alias("defensive_rating"),
            (pl.col("possessions") / pl.col("minutes")).alias("pace"),
            (pl.col("points_for") - pl.col("points_against")).alias("efficiency_diff"),
            pl.col("points_for").rolling_mean(window_size=5).alias("rolling_points_5"),
            pl.col("points_for").rolling_mean(window_size=10).alias("rolling_points_10"),
            (pl.col("home_win_pct") - pl.col("away_win_pct")).alias("home_away_strength"),
            (
                pl.struct(["prev_lat", "prev_lon", "venue_lat", "venue_lon"])
                .map_elements(
                    lambda row: haversine_distance_miles(
                        row["prev_lat"], row["prev_lon"], row["venue_lat"], row["venue_lon"]
                    ),
                    return_dtype=pl.Float64,
                )
                / (pl.col("rest_days") + 1)
            ).alias("travel_fatigue"),
        ]
    )
    logger.info("team_features_engineered", rows=engineered.height)
    return engineered.to_dicts()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/features/team")
async def team_features(payload: list[dict[str, Any]]) -> dict[str, Any]:
    features = build_team_features(payload)
    return {"generated_at": datetime.now(timezone.utc), "rows": len(features), "features": features}
