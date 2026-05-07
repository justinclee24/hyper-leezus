from __future__ import annotations

import asyncio
import sys

from services.data_ingestion.app.main import ingest_once
from services.db import init_db
from services.shared import logger


def main() -> None:
    init_db()
    results = asyncio.run(ingest_once())
    logger.info("cron_ingestion_complete", count=len(results), results=results)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        logger.error("cron_ingestion_failed", error=str(exc))
        sys.exit(1)
