from __future__ import annotations

from datetime import datetime

from airflow import DAG
from airflow.operators.python import PythonOperator

from ml.training.pipeline import TrainingOrchestrator


def run_training_job(league: str) -> None:
    TrainingOrchestrator().train_all(league, {"source": "airflow"})


with DAG(
    dag_id="sports_model_retraining",
    start_date=datetime(2024, 1, 1),
    schedule="0 5 * * 1",
    catchup=False,
    tags=["sports", "ml", "retraining"],
) as dag:
    for league in ["nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf", "soccer", "rugby"]:
        PythonOperator(
            task_id=f"train_{league}",
            python_callable=run_training_job,
            op_kwargs={"league": league},
        )
