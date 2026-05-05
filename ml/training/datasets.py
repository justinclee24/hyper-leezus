from __future__ import annotations

from datetime import datetime, timedelta, timezone
from random import Random

import pandas as pd

from ml.training.league_configs import LeagueTrainingProfile, get_profile
from services.db import session_scope
from services.repositories import TrainingRepository


TRAINING_FEATURES = [
    "power_rating_diff",
    "offensive_rating_diff",
    "defensive_rating_diff",
    "pace_diff",
    "rest_days_diff",
    "travel_fatigue_diff",
    "injury_impact_diff",
    "market_implied_home",
    "line_movement",
    "public_betting_pct",
    "sharp_betting_pct",
    "sentiment_diff",
    "weather_severity",
]


class DatasetBuilder:
    def build(self, league: str) -> pd.DataFrame:
        profile = get_profile(league)
        with session_scope() as session:
            repository = TrainingRepository(session)
            frame = self._build_from_db(repository, profile)
        if frame.empty:
            frame = self._synthetic_frame(profile, rows=320)
        return frame.sort_values("game_date").reset_index(drop=True)

    def _build_from_db(self, repository: TrainingRepository, profile: LeagueTrainingProfile) -> pd.DataFrame:
        team_rows = repository.load_team_game_stats(profile.league)
        if not team_rows:
            return pd.DataFrame()
        odds_by_game = repository.latest_odds_by_game(profile.league)
        weather_by_game = repository.latest_weather_by_game(profile.league)
        sentiment_by_team = repository.latest_sentiment(profile.league)
        injury_impact_by_team = repository.latest_injury_impact_by_team(profile.league)

        pairs: dict[str, dict[str, object]] = {}
        for row in team_rows:
            entry = pairs.setdefault(row.external_game_id, {"home": None, "away": None, "game_date": row.game_date})
            entry["home" if row.is_home else "away"] = row

        records: list[dict[str, float | int | str | datetime]] = []
        for game_id, pair in pairs.items():
            home = pair["home"]
            away = pair["away"]
            if home is None or away is None:
                continue
            odds = odds_by_game.get(game_id)
            weather = weather_by_game.get(game_id)
            home_sentiment = sentiment_by_team.get(home.team_id)
            away_sentiment = sentiment_by_team.get(away.team_id)
            records.append(
                {
                    "game_id": game_id,
                    "league": profile.league,
                    "game_date": pair["game_date"],
                    "power_rating_diff": (home.points_for - home.points_against) - (away.points_for - away.points_against),
                    "offensive_rating_diff": (home.points_for / max(home.possessions, 1.0)) - (away.points_for / max(away.possessions, 1.0)),
                    "defensive_rating_diff": (away.points_against / max(away.possessions, 1.0)) - (home.points_against / max(home.possessions, 1.0)),
                    "pace_diff": (home.possessions / max(home.minutes, 1.0)) - (away.possessions / max(away.minutes, 1.0)),
                    "rest_days_diff": float(home.rest_days - away.rest_days),
                    "travel_fatigue_diff": self._travel_fatigue(home) - self._travel_fatigue(away),
                    "injury_impact_diff": injury_impact_by_team.get(away.team_id, 0.0) - injury_impact_by_team.get(home.team_id, 0.0),
                    "market_implied_home": getattr(odds, "implied_probability_home", 0.5),
                    "line_movement": getattr(odds, "line_movement", 0.0),
                    "public_betting_pct": getattr(odds, "public_betting_pct", 0.5),
                    "sharp_betting_pct": getattr(odds, "sharp_betting_pct", 0.5),
                    "sentiment_diff": getattr(home_sentiment, "sentiment_score", 0.0) - getattr(away_sentiment, "sentiment_score", 0.0),
                    "weather_severity": self._weather_severity(weather) if profile.use_weather else 0.0,
                    "home_score": home.points_for,
                    "away_score": away.points_for,
                    "home_win": 1 if home.points_for > away.points_for else 0,
                    "spread_home_actual": away.points_for - home.points_for,
                    "total_actual": home.points_for + away.points_for,
                }
            )
        return pd.DataFrame.from_records(records)

    def _synthetic_frame(self, profile: LeagueTrainingProfile, rows: int) -> pd.DataFrame:
        random = Random(f"{profile.league}-seed")
        base_date = datetime.now(timezone.utc) - timedelta(days=rows)
        records: list[dict[str, float | int | str | datetime]] = []
        for index in range(rows):
            power_rating_diff = random.uniform(-12.0, 12.0)
            rest_days_diff = random.randint(-3, 3)
            weather_severity = random.uniform(0.0, 1.0) if profile.use_weather else 0.0
            market_implied_home = min(0.92, max(0.08, 0.5 + (power_rating_diff * 0.018)))
            total_noise = random.uniform(-12.0, 12.0) if profile.average_total > 20 else random.uniform(-1.2, 1.2)
            total_actual = profile.average_total + total_noise - (weather_severity * (6.0 if profile.use_weather else 0.0))
            margin = profile.home_edge + (power_rating_diff * 0.55) + (rest_days_diff * 0.4) - (weather_severity * 1.5)
            home_score = (total_actual + margin) / 2
            away_score = (total_actual - margin) / 2
            records.append(
                {
                    "game_id": f"{profile.league}-synthetic-{index}",
                    "league": profile.league,
                    "game_date": base_date + timedelta(days=index),
                    "power_rating_diff": power_rating_diff,
                    "offensive_rating_diff": random.uniform(-0.3, 0.3),
                    "defensive_rating_diff": random.uniform(-0.3, 0.3),
                    "pace_diff": random.uniform(-8.0, 8.0),
                    "rest_days_diff": float(rest_days_diff),
                    "travel_fatigue_diff": random.uniform(-2.0, 2.0),
                    "injury_impact_diff": random.uniform(-0.8, 0.8),
                    "market_implied_home": market_implied_home,
                    "line_movement": random.uniform(-2.5, 2.5),
                    "public_betting_pct": random.uniform(0.35, 0.78),
                    "sharp_betting_pct": random.uniform(0.35, 0.72),
                    "sentiment_diff": random.uniform(-0.5, 0.5),
                    "weather_severity": weather_severity,
                    "home_score": round(home_score, 2),
                    "away_score": round(away_score, 2),
                    "home_win": 1 if home_score > away_score else 0,
                    "spread_home_actual": round(away_score - home_score, 2),
                    "total_actual": round(total_actual, 2),
                }
            )
        return pd.DataFrame.from_records(records)

    @staticmethod
    def _weather_severity(weather: object | None) -> float:
        if weather is None:
            return 0.0
        return min(1.0, ((weather.wind_mph / 25.0) + weather.precipitation_pct + abs(weather.temperature_f - 65.0) / 50.0) / 3.0)

    @staticmethod
    def _travel_fatigue(row: object) -> float:
        lat_delta = abs(row.venue_lat - row.prev_lat)
        lon_delta = abs(row.venue_lon - row.prev_lon)
        return (lat_delta + lon_delta) / max(row.rest_days + 1, 1)
