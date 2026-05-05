from __future__ import annotations

from statistics import mean
from typing import Any


def compute_monitoring_snapshot(rows: list[dict[str, Any]]) -> dict[str, float]:
    if not rows:
        return {
            "accuracy": 0.0,
            "log_loss": 0.0,
            "brier_score": 0.0,
            "calibration_error": 0.0,
            "roi": 0.0,
        }
    return {
        "accuracy": mean(row.get("accuracy", 0.0) for row in rows),
        "log_loss": mean(row.get("log_loss", 0.0) for row in rows),
        "brier_score": mean(row.get("brier_score", 0.0) for row in rows),
        "calibration_error": mean(row.get("calibration_error", 0.0) for row in rows),
        "roi": mean(row.get("roi", 0.0) for row in rows),
    }
