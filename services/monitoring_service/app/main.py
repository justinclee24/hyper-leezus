from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI

from ml.evaluation.metrics import compute_monitoring_snapshot

app = FastAPI(title="monitoring-service", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/monitor/evaluate")
async def evaluate(payload: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "evaluated_at": datetime.now(timezone.utc),
        "summary": compute_monitoring_snapshot(payload),
    }
