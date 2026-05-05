from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from services.domain import (
    InjuryReportRecord,
    NormalizedIngestionBatch,
    OddsRecord,
    PlayerStatRecord,
    SentimentRecord,
    TeamStatRecord,
    WeatherRecord,
)
from services.shared import DataSource


class ProviderAdapter(ABC):
    def __init__(self, source: DataSource) -> None:
        self.source = source

    @abstractmethod
    def normalize(self, payload: dict[str, Any]) -> NormalizedIngestionBatch:
        raise NotImplementedError

    def now(self) -> datetime:
        return datetime.now(timezone.utc)


class SportsStatsAdapter(ProviderAdapter):
    def normalize(self, payload: dict[str, Any]) -> NormalizedIngestionBatch:
        collected_at = self.now()
        rows = self._extract_rows(payload, collected_at)
        team_stats: list[TeamStatRecord] = []
        player_stats: list[PlayerStatRecord] = []
        for row in rows:
            league = row["league"]
            game_id = row["external_game_id"]
            game_date = row.get("game_date", collected_at)
            home = row["home"]
            away = row["away"]
            team_stats.extend(
                [
                    TeamStatRecord(
                        provider=self.source.name,
                        league=league,
                        external_game_id=game_id,
                        team_id=home["team_id"],
                        team_name=home["team_name"],
                        opponent_id=away["team_id"],
                        opponent_name=away["team_name"],
                        is_home=True,
                        game_date=game_date,
                        points_for=home["points_for"],
                        points_against=home["points_against"],
                        possessions=row.get("possessions", 100),
                        minutes=row.get("minutes", 48),
                        home_win_pct=row.get("home_win_pct", 0.62),
                        away_win_pct=row.get("away_win_pct", 0.48),
                        rest_days=row.get("rest_days_home", 2),
                        metadata={"season_phase": row.get("season_phase", "regular")},
                    ),
                    TeamStatRecord(
                        provider=self.source.name,
                        league=league,
                        external_game_id=game_id,
                        team_id=away["team_id"],
                        team_name=away["team_name"],
                        opponent_id=home["team_id"],
                        opponent_name=home["team_name"],
                        is_home=False,
                        game_date=game_date,
                        points_for=away["points_for"],
                        points_against=away["points_against"],
                        possessions=row.get("possessions", 100),
                        minutes=row.get("minutes", 48),
                        home_win_pct=row.get("home_win_pct", 0.62),
                        away_win_pct=row.get("away_win_pct", 0.48),
                        rest_days=row.get("rest_days_away", 1),
                        metadata={"season_phase": row.get("season_phase", "regular")},
                    ),
                ]
            )
            for player in row.get("players", []):
                player_stats.append(
                    PlayerStatRecord(
                        provider=self.source.name,
                        league=league,
                        external_game_id=game_id,
                        player_id=player["player_id"],
                        player_name=player["player_name"],
                        team_id=player["team_id"],
                        minutes=player["minutes"],
                        usage_rate=player["usage_rate"],
                        efficiency_rating=player["efficiency_rating"],
                        lineup_synergy=player.get("lineup_synergy", 0.0),
                    )
                )
        return NormalizedIngestionBatch(
            source=self.source.name,
            collected_at=collected_at,
            team_stats=team_stats,
            player_stats=player_stats,
            raw_payload=payload,
        )

    def _extract_rows(self, payload: dict[str, Any], collected_at: datetime) -> list[dict[str, Any]]:
        requests = payload.get("provider_requests", [])
        rows: list[dict[str, Any]] = []
        for request in requests:
            league = request["league"]
            data = request.get("data", {})
            for game in data.get("games", []):
                if "home" not in game or "away" not in game:
                    continue
                rows.append(
                    {
                        "league": league,
                        "external_game_id": game.get("id") or game.get("game", {}).get("id") or f"{league}-unknown",
                        "game_date": game.get("scheduled") or collected_at,
                        "home": {
                            "team_id": game["home"].get("id", "home"),
                            "team_name": game["home"].get("name", "Home"),
                            "points_for": float(game["home"].get("points", 0) or 0),
                            "points_against": float(game["away"].get("points", 0) or 0),
                        },
                        "away": {
                            "team_id": game["away"].get("id", "away"),
                            "team_name": game["away"].get("name", "Away"),
                            "points_for": float(game["away"].get("points", 0) or 0),
                            "points_against": float(game["home"].get("points", 0) or 0),
                        },
                        "season_phase": game.get("status", "scheduled"),
                    }
                )
            for schedule in data.get("schedules", []):
                sport_event = schedule.get("sport_event", {})
                competitors = sport_event.get("competitors", [])
                if len(competitors) < 2:
                    continue
                home = next((team for team in competitors if team.get("qualifier") == "home"), competitors[0])
                away = next((team for team in competitors if team.get("qualifier") == "away"), competitors[1])
                rows.append(
                    {
                        "league": league,
                        "external_game_id": sport_event.get("id", f"{league}-unknown"),
                        "game_date": sport_event.get("start_time") or collected_at,
                        "home": {
                            "team_id": home.get("id", "home"),
                            "team_name": home.get("name", "Home"),
                            "points_for": float(schedule.get("sport_event_status", {}).get("home_score", 0) or 0),
                            "points_against": float(schedule.get("sport_event_status", {}).get("away_score", 0) or 0),
                        },
                        "away": {
                            "team_id": away.get("id", "away"),
                            "team_name": away.get("name", "Away"),
                            "points_for": float(schedule.get("sport_event_status", {}).get("away_score", 0) or 0),
                            "points_against": float(schedule.get("sport_event_status", {}).get("home_score", 0) or 0),
                        },
                        "season_phase": schedule.get("sport_event_status", {}).get("status", "scheduled"),
                    }
                )
        if rows:
            return rows
        return [
            {
                "league": "nba",
                "external_game_id": "nba-demo-001",
                "game_date": collected_at,
                "home": {
                    "team_id": "bos",
                    "team_name": "Boston Celtics",
                    "points_for": 118,
                    "points_against": 110,
                },
                "away": {
                    "team_id": "lal",
                    "team_name": "Los Angeles Lakers",
                    "points_for": 110,
                    "points_against": 118,
                },
                "players": [
                    {
                        "player_id": "player-bos-1",
                        "player_name": "Jayson Tatum",
                        "team_id": "bos",
                        "minutes": 37,
                        "usage_rate": 0.31,
                        "efficiency_rating": 25.4,
                        "lineup_synergy": 0.67,
                    }
                ],
            }
        ]


class OddsAdapter(ProviderAdapter):
    def normalize(self, payload: dict[str, Any]) -> NormalizedIngestionBatch:
        collected_at = self.now()
        rows = self._extract_rows(payload, collected_at)
        return NormalizedIngestionBatch(
            source=self.source.name,
            collected_at=collected_at,
            odds=[
                OddsRecord(
                    provider=self.source.name,
                    league=row["league"],
                    external_game_id=row["external_game_id"],
                    sportsbook=row["sportsbook"],
                    home_moneyline=row["home_moneyline"],
                    away_moneyline=row["away_moneyline"],
                    spread_home=row["spread_home"],
                    total=row["total"],
                    implied_probability_home=row["implied_probability_home"],
                    line_movement=row.get("line_movement", 0.0),
                    public_betting_pct=row.get("public_betting_pct", 0.5),
                    sharp_betting_pct=row.get("sharp_betting_pct", 0.5),
                    collected_at=collected_at,
                )
                for row in rows
            ],
            raw_payload=payload,
        )

    def _extract_rows(self, payload: dict[str, Any], collected_at: datetime) -> list[dict[str, Any]]:
        requests = payload.get("provider_requests", [])
        rows: list[dict[str, Any]] = []
        for request in requests:
            league = request["league"]
            for event in request.get("data", []):
                home_team = event.get("home_team")
                away_team = event.get("away_team")
                outcomes = []
                spreads = []
                totals = []
                for bookmaker in event.get("bookmakers", []):
                    for market in bookmaker.get("markets", []):
                        if market.get("key") == "h2h":
                            outcomes = market.get("outcomes", [])
                        elif market.get("key") == "spreads":
                            spreads = market.get("outcomes", [])
                        elif market.get("key") == "totals":
                            totals = market.get("outcomes", [])
                    home_moneyline = next((item.get("price") for item in outcomes if item.get("name") == home_team), -110)
                    away_moneyline = next((item.get("price") for item in outcomes if item.get("name") == away_team), -110)
                    spread_home = next((item.get("point") for item in spreads if item.get("name") == home_team), 0.0)
                    total = next((item.get("point") for item in totals), 0.0)
                    rows.append(
                        {
                            "league": league,
                            "external_game_id": event.get("id", f"{league}-odds"),
                            "sportsbook": bookmaker.get("key", "consensus"),
                            "home_moneyline": home_moneyline,
                            "away_moneyline": away_moneyline,
                            "spread_home": spread_home or 0.0,
                            "total": total or 0.0,
                            "implied_probability_home": self._moneyline_to_probability(home_moneyline),
                            "line_movement": 0.0,
                            "public_betting_pct": 0.5,
                            "sharp_betting_pct": 0.5,
                        }
                    )
        if rows:
            return rows
        return [
            {
                "league": "nba",
                "external_game_id": "nba-demo-001",
                "sportsbook": "consensus",
                "home_moneyline": -185,
                "away_moneyline": 155,
                "spread_home": -5.5,
                "total": 227.5,
                "implied_probability_home": 0.63,
                "line_movement": -1.5,
                "public_betting_pct": 0.68,
                "sharp_betting_pct": 0.54,
            }
        ]

    @staticmethod
    def _moneyline_to_probability(moneyline: float) -> float:
        if moneyline < 0:
            return abs(moneyline) / (abs(moneyline) + 100)
        return 100 / (moneyline + 100)


class InjuriesAdapter(ProviderAdapter):
    def normalize(self, payload: dict[str, Any]) -> NormalizedIngestionBatch:
        collected_at = self.now()
        rows = self._extract_rows(payload)
        return NormalizedIngestionBatch(
            source=self.source.name,
            collected_at=collected_at,
            injuries=[
                InjuryReportRecord(
                    provider=self.source.name,
                    league=row["league"],
                    player_id=row["player_id"],
                    team_id=row["team_id"],
                    status=row["status"],
                    impact_score=row.get("impact_score", 0.0),
                    collected_at=collected_at,
                )
                for row in rows
            ],
            raw_payload=payload,
        )

    def _extract_rows(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        requests = payload.get("provider_requests", [])
        rows: list[dict[str, Any]] = []
        for request in requests:
            league = request["league"]
            data = request.get("data", {})
            for team in data.get("teams", []):
                for player in team.get("players", []):
                    if not player.get("injury"):
                        continue
                    rows.append(
                        {
                            "league": league,
                            "player_id": player.get("id", "player"),
                            "team_id": team.get("id", "team"),
                            "status": player.get("injury", {}).get("status", "unknown"),
                            "impact_score": self._impact_score(player.get("injury", {}).get("status")),
                        }
                    )
        if rows:
            return rows
        return [
            {
                "league": "nba",
                "player_id": "player-bos-1",
                "team_id": "bos",
                "status": "probable",
                "impact_score": 0.12,
            }
        ]

    @staticmethod
    def _impact_score(status: str | None) -> float:
        mapping = {"out": 1.0, "doubtful": 0.75, "questionable": 0.45, "probable": 0.15}
        return mapping.get((status or "").lower(), 0.1)


class SentimentAdapter(ProviderAdapter):
    def normalize(self, payload: dict[str, Any]) -> NormalizedIngestionBatch:
        collected_at = self.now()
        rows = self._extract_rows(payload)
        return NormalizedIngestionBatch(
            source=self.source.name,
            collected_at=collected_at,
            sentiment=[
                SentimentRecord(
                    provider=self.source.name,
                    league=row["league"],
                    subject_id=row["subject_id"],
                    subject_type=row["subject_type"],
                    sentiment_score=row["sentiment_score"],
                    volume=row["volume"],
                    collected_at=collected_at,
                )
                for row in rows
            ],
            raw_payload=payload,
        )

    def _extract_rows(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        requests = payload.get("provider_requests", [])
        rows: list[dict[str, Any]] = []
        for request in requests:
            subject_id = request["league"]
            posts = request.get("data", {}).get("data", {}).get("children", [])
            titles = [post.get("data", {}).get("title", "") for post in posts]
            score = 0.0
            for title in titles:
                lowered = title.lower()
                score += 1.0 if any(word in lowered for word in ["win", "healthy", "dominant", "great"]) else 0.0
                score -= 1.0 if any(word in lowered for word in ["injury", "loss", "bad", "out"]) else 0.0
            normalized_score = score / max(len(titles), 1)
            rows.append(
                {
                    "league": subject_id,
                    "subject_id": subject_id,
                    "subject_type": "topic",
                    "sentiment_score": normalized_score,
                    "volume": len(titles),
                }
            )
        if rows:
            return rows
        return [
            {
                "league": "nba",
                "subject_id": "bos",
                "subject_type": "team",
                "sentiment_score": 0.34,
                "volume": 4200,
            }
        ]


class WeatherAdapter(ProviderAdapter):
    def normalize(self, payload: dict[str, Any]) -> NormalizedIngestionBatch:
        collected_at = self.now()
        rows = self._extract_rows(payload)
        return NormalizedIngestionBatch(
            source=self.source.name,
            collected_at=collected_at,
            weather=[
                WeatherRecord(
                    provider=self.source.name,
                    league=row["league"],
                    external_game_id=row["external_game_id"],
                    temperature_f=row["temperature_f"],
                    wind_mph=row["wind_mph"],
                    precipitation_pct=row["precipitation_pct"],
                    collected_at=collected_at,
                )
                for row in rows
            ],
            raw_payload=payload,
        )

    def _extract_rows(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        requests = payload.get("provider_requests", [])
        rows: list[dict[str, Any]] = []
        for request in requests:
            current = request.get("data", {}).get("current", {})
            rain_amount = current.get("rain", {}).get("1h", 0.0) if isinstance(current.get("rain"), dict) else 0.0
            rows.append(
                {
                    "league": request["league"],
                    "external_game_id": request.get("external_game_id") or f'{request["league"]}-weather',
                    "temperature_f": current.get("temp", 0.0),
                    "wind_mph": current.get("wind_speed", 0.0),
                    "precipitation_pct": min(1.0, float(rain_amount) / 10.0),
                }
            )
        if rows:
            return rows
        return [
            {
                "league": "nfl",
                "external_game_id": "nfl-demo-001",
                "temperature_f": 44.0,
                "wind_mph": 11.0,
                "precipitation_pct": 0.2,
            }
        ]


def build_adapter(source: DataSource) -> ProviderAdapter:
    mapping: dict[str, type[ProviderAdapter]] = {
        "sports_stats": SportsStatsAdapter,
        "odds": OddsAdapter,
        "injuries": InjuriesAdapter,
        "social_sentiment": SentimentAdapter,
        "weather": WeatherAdapter,
    }
    adapter_cls = mapping[source.name]
    return adapter_cls(source)
