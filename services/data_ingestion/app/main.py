from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import boto3
import httpx
from fastapi import FastAPI
from kafka import KafkaProducer

from services.db import init_db, session_scope
from services.providers import build_adapter
from services.repositories import IngestionRepository
from services.shared import DataSource, logger, settings

app = FastAPI(title="data-ingestion-service", version="0.1.0")

producer = KafkaProducer(
    bootstrap_servers=settings.kafka_bootstrap_servers,
    value_serializer=lambda value: value.encode("utf-8"),
)
s3 = boto3.client(
    "s3",
    endpoint_url=settings.s3_endpoint_url,
    aws_access_key_id=settings.s3_access_key,
    aws_secret_access_key=settings.s3_secret_key,
)

DATA_SOURCES = [
    DataSource("sports_stats", "https://api.sportradar.com", 60, enabled=bool(settings.sportradar_api_key)),
    DataSource("odds", "https://api.the-odds-api.com", 15, enabled=bool(settings.odds_api_key)),
    DataSource("injuries", "https://api.sportradar.com", 30, enabled=bool(settings.sportradar_api_key)),
    DataSource("social_sentiment", "https://oauth.reddit.com/search", 20, enabled=bool(settings.reddit_access_token)),
    DataSource("weather", "https://api.openweathermap.org/data/3.0/onecall", 60, enabled=bool(settings.weather_api_key)),
]


def enabled_sportradar_leagues() -> set[str]:
    return {
        league.strip().lower()
        for league in settings.sportradar_enabled_leagues.split(",")
        if league.strip()
    }


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
        s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=json.dumps(snapshot).encode("utf-8"))
        producer.send(f"raw.{source.name}", value=json.dumps(snapshot))
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


@app.on_event("startup")
async def startup() -> None:
    init_db()
