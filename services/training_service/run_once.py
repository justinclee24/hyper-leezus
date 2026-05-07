from __future__ import annotations

import sys

import mlflow

from ml.training.pipeline import TrainingOrchestrator
from services.db import init_db
from services.shared import logger, settings

LEAGUES = ["nba", "nhl", "mlb", "nfl", "ncaab"]


def main() -> None:
    if settings.mlflow_tracking_uri:
        mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    init_db()
    orchestrator = TrainingOrchestrator()
    failed: list[str] = []
    for league in LEAGUES:
        print(f"[training] starting {league}...", flush=True)
        try:
            artifact = orchestrator.train_all(league, {})
            print(f"[training] {league} OK — version={artifact['version']} rows={artifact['metrics']}", flush=True)
            logger.info("training_complete", league=league, artifact=artifact)
        except Exception as exc:
            import traceback
            print(f"[training] {league} FAILED: {exc}", flush=True)
            traceback.print_exc()
            logger.error("training_failed", league=league, error=str(exc))
            failed.append(league)

    if failed:
        print(f"[training] FAILED leagues: {failed}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        logger.error("cron_training_failed", error=str(exc))
        sys.exit(1)
