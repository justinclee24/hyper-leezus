from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class LeagueTrainingProfile:
    league: str
    regulation_minutes: int
    average_total: float
    home_edge: float
    use_weather: bool
    use_draw_signal: bool = False
    # Minimum real game-rows before accepting the dataset as real data.
    # Below this, fall back to synthetic to avoid training on noise.
    min_real_games: int = 40


LEAGUE_PROFILES: dict[str, LeagueTrainingProfile] = {
    "nba": LeagueTrainingProfile(
        "nba",
        regulation_minutes=48,
        average_total=228.0,
        home_edge=2.8,
        use_weather=False,
        min_real_games=60,   # 82-game season, expect 60+ rows per team quickly
    ),
    "nfl": LeagueTrainingProfile(
        "nfl",
        regulation_minutes=60,
        average_total=45.0,
        home_edge=1.8,
        use_weather=True,
        min_real_games=40,   # 17-game season, lower bar
    ),
    "nhl": LeagueTrainingProfile(
        "nhl",
        regulation_minutes=60,
        average_total=6.1,
        home_edge=0.18,
        use_weather=False,
        min_real_games=60,
    ),
    "mlb": LeagueTrainingProfile(
        "mlb",
        regulation_minutes=54,
        average_total=8.8,
        home_edge=0.22,
        use_weather=True,
        min_real_games=80,   # 162-game season — wait for solid sample
    ),
    "ncaab": LeagueTrainingProfile(
        "ncaab",
        regulation_minutes=40,
        average_total=143.0,
        home_edge=3.4,
        use_weather=False,
        min_real_games=50,
    ),
    "ncaaf": LeagueTrainingProfile(
        "ncaaf",
        regulation_minutes=60,
        average_total=53.0,
        home_edge=2.6,
        use_weather=True,
        min_real_games=30,
    ),
    "soccer": LeagueTrainingProfile(
        "soccer",
        regulation_minutes=90,
        average_total=2.7,
        home_edge=0.24,
        use_weather=False,
        use_draw_signal=True,
        min_real_games=40,
    ),
    "rugby": LeagueTrainingProfile(
        "rugby",
        regulation_minutes=80,
        average_total=46.0,
        home_edge=2.1,
        use_weather=False,
        min_real_games=30,
    ),
}


def get_profile(league: str) -> LeagueTrainingProfile:
    try:
        return LEAGUE_PROFILES[league]
    except KeyError as exc:
        raise ValueError(f"Unsupported league: {league}") from exc
