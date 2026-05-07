from __future__ import annotations

import argparse
import asyncio
import sys

from services.data_ingestion.app.main import run_backfill
from services.db import init_db
from services.shared import logger


def main(days_back: int, sport: str | None) -> None:
    init_db()
    result = asyncio.run(run_backfill(days_back=days_back, sport=sport or None))
    print(f"[backfill] saved {result['saved_team_stats']} team_stat rows", flush=True)
    print(f"[backfill] sports={result['sports']} days_back={result['days_back']}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days-back", type=int, default=180)
    parser.add_argument("--sport", type=str, default="")
    args = parser.parse_args()
    try:
        main(days_back=args.days_back, sport=args.sport or None)
    except Exception as exc:
        logger.error("backfill_failed", error=str(exc))
        sys.exit(1)
