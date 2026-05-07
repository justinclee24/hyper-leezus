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
    for league in LEAGUES:
        try:
            artifact = orchestrator.train_all(league, {})
            logger.info("training_complete", league=league, artifact=artifact)
        except Exception as exc:
            logger.error("training_failed", league=league, error=str(exc))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        logger.error("cron_training_failed", error=str(exc))
        sys.exit(1)
