from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import FastAPI

from services.db import init_db, session_scope
from services.providers import ESPNAdapter, build_adapter
from services.repositories import IngestionRepository
from services.shared import DataSource, logger, settings

app = FastAPI(title="data-ingestion-service", version="0.1.0")

_producer = None
_s3 = None


def get_producer():
    global _producer
    if _producer is None and settings.kafka_bootstrap_servers:
        from kafka import KafkaProducer  # noqa: PLC0415
        _producer = KafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda value: value.encode("utf-8"),
        )
    return _producer


def get_s3():
    global _s3
    if _s3 is None and settings.s3_endpoint_url:
        import boto3  # noqa: PLC0415
        _s3 = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
        )
    return _s3

DATA_SOURCES = [
    DataSource("sports_stats", "https://api.sportradar.com", 60, enabled=bool(settings.sportradar_api_key)),
    DataSource("odds", "https://api.the-odds-api.com", 15, enabled=bool(settings.odds_api_key)),
    DataSource("scores", "https://api.the-odds-api.com", 15, enabled=False),  # ESPN covers scores; disabled to stay within Odds API free tier (500/month)
    DataSource("injuries", "https://api.sportradar.com", 30, enabled=bool(settings.sportradar_api_key)),
    DataSource("social_sentiment", "https://oauth.reddit.com/search", 20, enabled=bool(settings.reddit_access_token)),
    DataSource("weather", "https://api.openweathermap.org/data/3.0/onecall", 60, enabled=bool(settings.weather_api_key)),
]

ESPN_SPORT_PATHS: dict[str, str] = {
    "nba": "basketball/nba",
    "nfl": "football/nfl",
    "nhl": "hockey/nhl",
    "mlb": "baseball/mlb",
    "ncaab": "basketball/mens-college-basketball",
    "ncaaf": "football/college-football",
}


def enabled_sportradar_leagues() -> set[str]:
    return {
        league.strip().lower()
        for league in settings.sportradar_enabled_leagues.split(",")
        if league.strip()
    }


# Months (0=Jan) each Odds API sport key has active games.
# Skipping off-season sports saves API credits on the free 500/month tier.
_ODDS_ACTIVE_MONTHS: dict[str, list[int]] = {
    "nba":    [0,1,2,3,4,5,9,10,11],  # Oct–Jun
    "nhl":    [0,1,2,3,4,5,9,10,11],  # Oct–Jun
    "mlb":    [2,3,4,5,6,7,8,9],      # Mar–Oct
    "nfl":    [0,1,8,9,10,11],         # Sep–Feb
    "ncaab":  [0,1,2,3,10,11],         # Nov–Apr
    "ncaaf":  [0,1,8,9,10,11],         # Aug–Jan
    "soccer": [0,1,2,3,4,7,8,9,10,11], # Aug–May (EPL)
    "rugby":  [0,1,2,3,4,5,6,7,8,9,10,11],
}

def _in_season(league_key: str) -> bool:
    m = datetime.now(timezone.utc).month - 1  # 0-indexed
    return m in _ODDS_ACTIVE_MONTHS.get(league_key, list(range(12)))

# Backend ingestion only tracks core sports the ML models are trained on.
# MLS, EPL, MMA are served by the frontend directly and don't need backend ingestion.
_BACKEND_CORE_SPORTS = {"nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf"}


def build_source_requests(source: DataSource) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    date_str = now.strftime("%Y-%m-%d")
    language = settings.sportradar_language_code
    access_level = settings.sportradar_access_level

    if source.name == "sports_stats":
        requests = [
            {"provider": "sportradar", "league": "nba", "url": f"{source.endpoint}/nba/{access_level}/v8/{language}/games/{year}/{month}/{day}/schedule.json"},
            {"provider": "sportradar", "league": "nfl", "url": f"{source.endpoint}/nfl/official/{access_level}/v7/{language}/games/current_week/schedule.json"},
            {"provider": "sportradar", "league": "nhl", "url": f"{source.endpoint}/nhl/{access_level}/v7/{language}/games/{year}/{month}/{day}/schedule.json"},
            {"provider": "sportradar", "league": "mlb", "url": f"{source.endpoint}/mlb/{access_level}/v7/{language}/games/{year}/{month}/{day}/schedule.json"},
            {"provider": "sportradar", "league": "ncaab", "url": f"{source.endpoint}/ncaamb/{access_level}/v8/{language}/games/{year}/{month}/{day}/schedule.json"},
            {"provider": "sportradar", "league": "ncaaf", "url": f"{source.endpoint}/ncaafb/{access_level}/v7/{language}/games/current_week/schedule.json"},
            {"provider": "sportradar", "league": "soccer", "url": f"{source.endpoint}/soccer/{access_level}/v4/{language}/schedules/{date_str}/schedules.json"},
            {"provider": "sportradar", "league": "rugby", "url": f"{source.endpoint}/rugby-{settings.sportradar_rugby_package}/{access_level}/v3/{language}/schedules/{date_str}/summaries.json"},
        ]
        enabled = enabled_sportradar_leagues()
        return [request for request in requests if request["league"] in enabled]
    if source.name == "injuries":
        requests = [
            {"provider": "sportradar", "league": "nba", "url": f"{source.endpoint}/nba/{access_level}/v8/{language}/league/injuries.json"},
            {"provider": "sportradar", "league": "nhl", "url": f"{source.endpoint}/nhl/{access_level}/v7/{language}/league/injuries.json"},
            {"provider": "sportradar", "league": "mlb", "url": f"{source.endpoint}/mlb/{access_level}/v8/{language}/league/injuries.json"},
            {
                "provider": "sportradar",
                "league": "nfl",
                "url": f"{source.endpoint}/nfl/official/{access_level}/v7/{language}/seasons/{settings.nfl_season_year}/{settings.nfl_season_type}/{settings.nfl_week}/injuries.json",
            },
            {
                "provider": "sportradar",
                "league": "ncaaf",
                "url": f"{source.endpoint}/ncaafb/{access_level}/v7/{language}/seasons/{settings.ncaaf_season_year}/{settings.ncaaf_season_type}/{settings.ncaaf_week}/injuries.json",
            },
        ]
        enabled = enabled_sportradar_leagues()
        return [request for request in requests if request["league"] in enabled]
    if source.name == "odds":
        sport_keys = {
            "nba": "basketball_nba",
            "nfl": "americanfootball_nfl",
            "nhl": "icehockey_nhl",
            "mlb": "baseball_mlb",
            "ncaab": "basketball_ncaab",
            "ncaaf": "americanfootball_ncaaf",
            "soccer": "soccer_epl",
            "rugby": "rugbyleague_nrl",
        }
        return [
            {
                "provider": "the_odds_api",
                "league": league,
                "url": f"{source.endpoint}/v4/sports/{sport_key}/odds",
                "params": {
                    "apiKey": settings.odds_api_key,
                    "regions": settings.odds_api_regions,
                    "markets": settings.odds_api_markets,
                    "oddsFormat": "american",
                    "dateFormat": "iso",
                },
            }
            for league, sport_key in sport_keys.items()
            if _in_season(league) and league in _BACKEND_CORE_SPORTS
        ]
    if source.name == "scores":
        sport_keys = {
            "nba": "basketball_nba",
            "nfl": "americanfootball_nfl",
            "nhl": "icehockey_nhl",
            "mlb": "baseball_mlb",
            "ncaab": "basketball_ncaab",
            "ncaaf": "americanfootball_ncaaf",
            "soccer": "soccer_epl",
        }
        return [
            {
                "provider": "the_odds_api",
                "league": league,
                "url": f"{source.endpoint}/v4/sports/{sport_key}/scores/",
                "params": {
                    "apiKey": settings.odds_api_key,
                    "daysFrom": 3,
                    "dateFormat": "iso",
                },
            }
            for league, sport_key in sport_keys.items()
            if _in_season(league)
        ]
    if source.name == "social_sentiment":
        search_terms = json.loads(settings.social_search_terms_json)
        return [
            {
                "provider": "reddit",
                "league": "social",
                "url": source.endpoint,
                "params": {"q": term, "sort": "new", "limit": 25, "raw_json": 1, "type": "link"},
            }
            for term in search_terms
        ]
    if source.name == "weather":
        locations = json.loads(settings.weather_locations_json)
        return [
            {
                "provider": "openweather",
                "league": location["league"],
                "external_game_id": location["external_game_id"],
                "url": source.endpoint,
                "params": {
                    "lat": location["lat"],
                    "lon": location["lon"],
                    "appid": settings.weather_api_key,
                    "units": settings.weather_units,
                    "exclude": "minutely,daily,alerts",
                },
            }
            for location in locations
        ]
    return [{"provider": "generic", "league": "generic", "url": source.endpoint}]


def request_headers(provider: str) -> dict[str, str]:
    if provider == "sportradar":
        return {"x-api-key": settings.sportradar_api_key}
    if provider == "reddit":
        headers = {"User-Agent": settings.reddit_user_agent}
        if settings.reddit_access_token:
            headers["Authorization"] = f"Bearer {settings.reddit_access_token}"
        return headers
    return {}


async def fetch_source(source: DataSource) -> dict[str, Any]:
    requests = build_source_requests(source)
    request_payloads: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=20) as client:
        for request in requests:
            try:
                response = await client.get(
                    request["url"],
                    headers=request_headers(request["provider"]),
                    params=request.get("params"),
                )
                response.raise_for_status()
                request_payloads.append(
                    {
                        "provider": request["provider"],
                        "league": request["league"],
                        "external_game_id": request.get("external_game_id"),
                        "data": response.json(),
                    }
                )
            except Exception:
                request_payloads.append(
                    {
                        "provider": request["provider"],
                        "league": request["league"],
                        "external_game_id": request.get("external_game_id"),
                        "data": {"records": [], "note": "live provider request failed; using adapter fallback"},
                    }
                )
    payload = {
        "source": source.name,
        "provider_requests": request_payloads,
    }
    return {
        "source": source.name,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }


async def ingest_once() -> list[dict[str, Any]]:
    snapshots: list[dict[str, Any]] = []
    for source in DATA_SOURCES:
        if not source.enabled:
            continue
        snapshot = await fetch_source(source)
        key = f"raw/{source.name}/{datetime.now(timezone.utc):%Y/%m/%d/%H%M%S}.json"
        s3_client = get_s3()
        if s3_client:
            s3_client.put_object(Bucket=settings.s3_bucket, Key=key, Body=json.dumps(snapshot).encode("utf-8"))
        kafka = get_producer()
        if kafka:
            kafka.send(f"raw.{source.name}", value=json.dumps(snapshot))
        normalized = build_adapter(source).normalize(snapshot.get("payload", {}))
        with session_scope() as session:
            counts = IngestionRepository(session).save_batch(normalized, s3_key=key)
        snapshots.append({"source": source.name, "s3_key": key, "counts": counts})
        logger.info("ingested_source", source=source.name, key=key)
    return snapshots


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest/run")
async def run_ingestion() -> dict[str, Any]:
    results = await ingest_once()
    return {"ingested": results, "count": len(results)}


@app.post("/ingest/backfill")
async def run_backfill(days_back: int = 30, sport: str | None = None) -> dict[str, Any]:
    """Fetch historical scores from ESPN for a date range and store as TeamGameStat rows.

    ESPN game IDs differ from The-Odds-API UUIDs, so these rows won't match MarketOdds
    directly. They do populate per-team rolling performance history used as power-rating
    features during model training.
    """
    sports_to_fetch = {sport: ESPN_SPORT_PATHS[sport]} if sport and sport in ESPN_SPORT_PATHS else ESPN_SPORT_PATHS
    source = DataSource("espn_scores", "https://site.api.espn.com/apis/site/v2/sports", 0, enabled=True)
    adapter = ESPNAdapter(source)

    end_date = datetime.now(timezone.utc)
    dates = [end_date - timedelta(days=i) for i in range(days_back)]

    import asyncio as _asyncio

    total_saved = 0
    async with httpx.AsyncClient(timeout=20) as client:
        for sport_league, sport_path in sports_to_fetch.items():

            async def fetch_day(date: datetime, _league: str = sport_league, _path: str = sport_path) -> int:
                date_str = date.strftime("%Y%m%d")
                url = f"{source.endpoint}/{_path}/scoreboard"
                try:
                    resp = await client.get(url, params={"dates": date_str, "limit": 100})
                    resp.raise_for_status()
                    data = resp.json()
                except Exception:
                    return 0

                payload = {"source": "espn_scores", "provider_requests": [{"provider": "espn", "league": _league, "data": data}]}
                normalized = adapter.normalize(payload)
                normalized = normalized.model_copy(update={
                    "raw_payload": {"source": "espn_scores", "league": _league, "date": date_str}
                })
                with session_scope() as session:
                    counts = IngestionRepository(session).save_batch(
                        normalized, s3_key=f"backfill/espn/{_league}/{date_str}"
                    )
                return counts.get("team_stats", 0)

            # Fetch all dates for this sport concurrently (ESPN has no strict rate limit)
            results = await _asyncio.gather(*[fetch_day(d) for d in dates])
            sport_saved = sum(results)
            total_saved += sport_saved
            logger.info("backfill_complete", league=sport_league, team_stats=sport_saved)

    return {"saved_team_stats": total_saved, "sports": list(sports_to_fetch.keys()), "days_back": days_back}


@app.on_event("startup")
async def startup() -> None:
    init_db()
