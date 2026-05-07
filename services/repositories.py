from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from services.domain import (
    InjuryReportRecord,
    NormalizedIngestionBatch,
    OddsRecord,
    PlayerStatRecord,
    SentimentRecord,
    TeamStatRecord,
    WeatherRecord,
)
from services.models import (
    InjuryReport,
    MarketOdds,
    ModelTrainingRun,
    PlayerGameStat,
    PredictionRecord,
    RawIngestionRecord,
    SentimentSignal,
    TeamGameStat,
    WeatherSnapshot,
)


def _upsert(session: Session, model: type, filters: dict[str, Any], values: dict[str, Any]) -> None:
    instance = session.execute(select(model).filter_by(**filters)).scalar_one_or_none()
    if instance is None:
        session.add(model(**filters, **values))
        return
    for key, value in values.items():
        setattr(instance, key, value)


class IngestionRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def save_batch(self, batch: NormalizedIngestionBatch, s3_key: str) -> dict[str, int]:
        self.session.add(
            RawIngestionRecord(
                source=batch.source,
                collected_at=batch.collected_at,
                s3_key=s3_key,
                payload=batch.raw_payload,
            )
        )
        for record in batch.team_stats:
            self._save_team_stat(record)
        for record in batch.player_stats:
            self._save_player_stat(record)
        for record in batch.odds:
            self._save_odds(record)
        for record in batch.injuries:
            self._save_injury(record)
        for record in batch.sentiment:
            self._save_sentiment(record)
        for record in batch.weather:
            self._save_weather(record)
        return {
            "team_stats": len(batch.team_stats),
            "player_stats": len(batch.player_stats),
            "odds": len(batch.odds),
            "injuries": len(batch.injuries),
            "sentiment": len(batch.sentiment),
            "weather": len(batch.weather),
        }

    def _save_team_stat(self, record: TeamStatRecord) -> None:
        payload = record.model_dump()
        filters = {
            "league": record.league,
            "external_game_id": record.external_game_id,
            "team_id": record.team_id,
        }
        metadata = payload.pop("metadata")
        values = {key: value for key, value in payload.items() if key not in filters} | {
            "metadata_json": metadata
        }
        _upsert(self.session, TeamGameStat, filters, values)

    def _save_player_stat(self, record: PlayerStatRecord) -> None:
        payload = record.model_dump()
        filters = {
            "league": record.league,
            "external_game_id": record.external_game_id,
            "player_id": record.player_id,
        }
        metadata = payload.pop("metadata")
        values = {key: value for key, value in payload.items() if key not in filters} | {
            "metadata_json": metadata
        }
        _upsert(self.session, PlayerGameStat, filters, values)

    def _save_odds(self, record: OddsRecord) -> None:
        payload = record.model_dump()
        filters = {
            "league": record.league,
            "external_game_id": record.external_game_id,
            "sportsbook": record.sportsbook,
            "collected_at": record.collected_at,
        }
        _upsert(self.session, MarketOdds, filters, {key: value for key, value in payload.items() if key not in filters})

    def _save_injury(self, record: InjuryReportRecord) -> None:
        payload = record.model_dump()
        filters = {
            "league": record.league,
            "player_id": record.player_id,
            "collected_at": record.collected_at,
        }
        _upsert(self.session, InjuryReport, filters, {key: value for key, value in payload.items() if key not in filters})

    def _save_sentiment(self, record: SentimentRecord) -> None:
        payload = record.model_dump()
        filters = {
            "league": record.league,
            "subject_id": record.subject_id,
            "subject_type": record.subject_type,
            "collected_at": record.collected_at,
        }
        _upsert(self.session, SentimentSignal, filters, {key: value for key, value in payload.items() if key not in filters})

    def _save_weather(self, record: WeatherRecord) -> None:
        payload = record.model_dump()
        filters = {
            "league": record.league,
            "external_game_id": record.external_game_id,
            "collected_at": record.collected_at,
        }
        _upsert(self.session, WeatherSnapshot, filters, {key: value for key, value in payload.items() if key not in filters})


class TrainingRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def load_team_game_stats(self, league: str, limit: int = 5000) -> list[TeamGameStat]:
        stmt = (
            select(TeamGameStat)
            .where(TeamGameStat.league == league)
            .order_by(desc(TeamGameStat.game_date))
            .limit(limit)
        )
        return list(self.session.execute(stmt).scalars())

    def latest_odds_by_game(self, league: str) -> dict[str, MarketOdds]:
        rows = list(
            self.session.execute(
                select(MarketOdds)
                .where(MarketOdds.league == league)
                .order_by(MarketOdds.external_game_id, desc(MarketOdds.collected_at))
            ).scalars()
        )
        latest: dict[str, MarketOdds] = {}
        for row in rows:
            latest.setdefault(row.external_game_id, row)
        return latest

    def latest_sentiment(self, league: str) -> dict[str, SentimentSignal]:
        rows = list(
            self.session.execute(
                select(SentimentSignal)
                .where(SentimentSignal.league == league)
                .order_by(SentimentSignal.subject_id, desc(SentimentSignal.collected_at))
            ).scalars()
        )
        latest: dict[str, SentimentSignal] = {}
        for row in rows:
            latest.setdefault(row.subject_id, row)
        return latest

    def latest_weather_by_game(self, league: str) -> dict[str, WeatherSnapshot]:
        rows = list(
            self.session.execute(
                select(WeatherSnapshot)
                .where(WeatherSnapshot.league == league)
                .order_by(WeatherSnapshot.external_game_id, desc(WeatherSnapshot.collected_at))
            ).scalars()
        )
        latest: dict[str, WeatherSnapshot] = {}
        for row in rows:
            latest.setdefault(row.external_game_id, row)
        return latest

    def latest_injury_by_player(self, league: str) -> dict[str, InjuryReport]:
        rows = list(
            self.session.execute(
                select(InjuryReport)
                .where(InjuryReport.league == league)
                .order_by(InjuryReport.player_id, desc(InjuryReport.collected_at))
            ).scalars()
        )
        latest: dict[str, InjuryReport] = {}
        for row in rows:
            latest.setdefault(row.player_id, row)
        return latest

    def latest_injury_impact_by_team(self, league: str) -> dict[str, float]:
        totals: dict[str, float] = {}
        for injury in self.latest_injury_by_player(league).values():
            totals[injury.team_id] = totals.get(injury.team_id, 0.0) + injury.impact_score
        return totals

    def save_training_run(
        self,
        league: str,
        version: str,
        params: dict[str, Any],
        metrics: dict[str, float],
        artifact_uri: str,
        model_blob: bytes | None = None,
        training_window_start: datetime | None = None,
        training_window_end: datetime | None = None,
    ) -> None:
        self.session.add(
            ModelTrainingRun(
                league=league,
                model_version=version,
                training_window_start=training_window_start or datetime(2020, 1, 1, tzinfo=timezone.utc),
                training_window_end=training_window_end or datetime.now(timezone.utc),
                metrics_json=metrics,
                params_json=params,
                artifact_uri=artifact_uri,
                model_blob=model_blob,
            )
        )

    def save_prediction_record(self, payload: dict[str, Any]) -> None:
        self.session.add(PredictionRecord(**payload))
