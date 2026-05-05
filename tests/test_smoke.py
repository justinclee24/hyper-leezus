from __future__ import annotations

import unittest

from ml.training.datasets import DatasetBuilder
from ml.training.league_configs import get_profile
from ml.training.trainers import LeagueTrainer
from services.providers import OddsAdapter, SentimentAdapter, SportsStatsAdapter, WeatherAdapter
from services.shared import DataSource


class ProviderAdapterSmokeTests(unittest.TestCase):
    def test_sports_stats_adapter_normalizes_sportradar_games(self) -> None:
        adapter = SportsStatsAdapter(DataSource("sports_stats", "https://api.sportradar.com", 60))
        batch = adapter.normalize(
            {
                "provider_requests": [
                    {
                        "provider": "sportradar",
                        "league": "nba",
                        "data": {
                            "games": [
                                {
                                    "id": "game-1",
                                    "scheduled": "2026-04-02T18:00:00Z",
                                    "home": {"id": "bos", "name": "Boston Celtics", "points": 114},
                                    "away": {"id": "nyk", "name": "New York Knicks", "points": 108},
                                }
                            ]
                        },
                    }
                ]
            }
        )
        self.assertEqual(len(batch.team_stats), 2)
        self.assertEqual(batch.team_stats[0].league, "nba")

    def test_odds_adapter_normalizes_market_payload(self) -> None:
        adapter = OddsAdapter(DataSource("odds", "https://api.the-odds-api.com", 15))
        batch = adapter.normalize(
            {
                "provider_requests": [
                    {
                        "provider": "the_odds_api",
                        "league": "nfl",
                        "data": [
                            {
                                "id": "event-1",
                                "home_team": "Buffalo Bills",
                                "away_team": "Kansas City Chiefs",
                                "bookmakers": [
                                    {
                                        "key": "draftkings",
                                        "markets": [
                                            {
                                                "key": "h2h",
                                                "outcomes": [
                                                    {"name": "Buffalo Bills", "price": -120},
                                                    {"name": "Kansas City Chiefs", "price": 102},
                                                ],
                                            },
                                            {
                                                "key": "spreads",
                                                "outcomes": [
                                                    {"name": "Buffalo Bills", "point": -1.5},
                                                    {"name": "Kansas City Chiefs", "point": 1.5},
                                                ],
                                            },
                                            {"key": "totals", "outcomes": [{"name": "Over", "point": 48.5}]},
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }
        )
        self.assertEqual(len(batch.odds), 1)
        self.assertAlmostEqual(batch.odds[0].implied_probability_home, 0.5454, places=3)

    def test_sentiment_and_weather_adapters_normalize_live_payloads(self) -> None:
        sentiment = SentimentAdapter(DataSource("social_sentiment", "https://oauth.reddit.com/search", 20)).normalize(
            {
                "provider_requests": [
                    {
                        "provider": "reddit",
                        "league": "nba",
                        "data": {
                            "data": {
                                "children": [
                                    {"data": {"title": "Great win for Boston"}},
                                    {"data": {"title": "Injury concern heading into playoffs"}},
                                ]
                            }
                        },
                    }
                ]
            }
        )
        weather = WeatherAdapter(DataSource("weather", "https://api.openweathermap.org/data/3.0/onecall", 60)).normalize(
            {
                "provider_requests": [
                    {
                        "provider": "openweather",
                        "league": "nfl",
                        "external_game_id": "weather-1",
                        "data": {"current": {"temp": 43.0, "wind_speed": 12.0, "rain": {"1h": 1.5}}},
                    }
                ]
            }
        )
        self.assertEqual(sentiment.sentiment[0].subject_id, "nba")
        self.assertEqual(weather.weather[0].external_game_id, "weather-1")


class TrainingSmokeTests(unittest.TestCase):
    def test_trainer_builds_artifact_from_synthetic_frame(self) -> None:
        profile = get_profile("nba")
        frame = DatasetBuilder()._synthetic_frame(profile, rows=48)
        bundle = LeagueTrainer(artifact_root="artifacts/test-models").train(
            frame=frame,
            profile=profile,
            version="nba-smoke-test",
            params={"n_estimators": 50, "max_depth": 4, "learning_rate": 0.05},
        )
        self.assertEqual(bundle.profile.league, "nba")
        self.assertIn("accuracy", bundle.metrics)


if __name__ == "__main__":
    unittest.main()
