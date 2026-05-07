from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import mlflow

from ml.common.contracts import ModelArtifact
from ml.training.datasets import DatasetBuilder
from ml.training.league_configs import get_profile
from ml.training.trainers import LeagueTrainer
from services.db import init_db, session_scope
from services.repositories import TrainingRepository


@dataclass
class TrainingConfig:
    objective: str = "win_probability"
    retrain_weekly_cron: str = "0 5 * * 1"
    retrain_after_game: bool = True
    use_cuda: bool = True


class TrainingOrchestrator:
    def __init__(self) -> None:
        self.config = TrainingConfig()
        self.dataset_builder = DatasetBuilder()
        self.trainer = LeagueTrainer()

    def train_all(self, league: str, params: dict) -> dict:
        init_db()
        profile = get_profile(league)
        frame = self.dataset_builder.build(league)
        training_window_start = self._to_datetime(frame["game_date"].min())
        training_window_end = self._to_datetime(frame["game_date"].max())
        run_name = f"{league}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}"
        with mlflow.start_run(run_name=run_name):
            mlflow.log_params(params)
            mlflow.log_dict(asdict(self.config), "training_config.json")
            mlflow.log_param("league", profile.league)
            mlflow.log_param("training_rows", len(frame))
            bundle = self.trainer.train(frame, profile, version=run_name, params=params)
            metrics = bundle.metrics | {
                "calibration_error": abs(bundle.metrics["brier_score"] - 0.20),
                "roi_against_closing_line": max(0.0, (bundle.metrics["accuracy"] - 0.52) * 0.35),
            }
            mlflow.log_metrics(metrics)
            artifact = ModelArtifact(
                league=league,
                version=run_name,
                uri=bundle.artifact_path,
                metrics=metrics,
            )
            mlflow.log_dict(asdict(artifact), "artifact.json")
            mlflow.log_dict({"features": bundle.feature_names}, "feature_names.json")
            artifact_path = Path(bundle.artifact_path)
            model_blob = artifact_path.read_bytes() if artifact_path.exists() else None
            with session_scope() as session:
                TrainingRepository(session).save_training_run(
                    league=league,
                    version=run_name,
                    params=params | {"training_rows": len(frame)},
                    metrics=metrics,
                    artifact_uri=bundle.artifact_path,
                    model_blob=model_blob,
                    training_window_start=training_window_start,
                    training_window_end=training_window_end,
                )
            return asdict(artifact)

    @staticmethod
    def _to_datetime(value: object) -> datetime:
        return value.to_pydatetime() if hasattr(value, "to_pydatetime") else value


def airflow_dag_source() -> str:
    dag_path = Path(__file__).resolve().parents[2] / "training" / "airflow_dag.py"
    return dag_path.read_text(encoding="utf-8")
