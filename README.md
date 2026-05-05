# Hyper Leezus Sports Analytics Platform

Production-oriented sports analytics and prediction platform for NBA, NFL, NHL, MLB, college basketball/football, soccer, and rugby. The repo is structured as a microservice monorepo with data ingestion, feature engineering, model training, prediction serving, monitoring, and a modern analytics dashboard.

## Architecture

- `services/data_ingestion`: Pulls hourly historical/live data from sports, odds, injury, social, and weather providers into the raw data lake and Kafka topics.
- `services/feature_pipeline`: Builds team, player, market, contextual, and sentiment features; publishes offline/online feature sets.
- `services/training_service`: Runs Optuna tuning, model training, stacking/blending, MLflow tracking, and registry promotion.
- `services/prediction_api`: FastAPI service for pregame and live predictions, explainability, and registry-backed model loading.
- `services/realtime_streaming`: WebSocket fanout for live prediction updates and game-state deltas.
- `services/monitoring_service`: Captures prediction outcomes, calibration, ROI, drift, and operational health.
- `ml/feast_repo`: Feast entities, feature views, and registry config.
- `ml/models`: Reference implementations for tree, neural, sequence, Bayesian, and graph models.
- `ml/training`: Shared training/orchestration utilities and Airflow DAG.
- `frontend`: Next.js dashboard with pages for games, teams, players, and analytics.
- `infra/docker`, `infra/k8s`, `infra/terraform`: Local and cloud deployment assets.

## Local Development

1. Copy environment files:
   - `cp .env.example .env`
2. Create a Python 3.11 virtual environment:
   - `python -m venv .venv311`
   - `.venv311\Scripts\python.exe -m pip install -U pip`
3. Start infrastructure and services:
   - `docker compose up --build`
4. Start the frontend separately if desired:
   - `cd frontend && npm install && npm run dev`
5. Run Feast materialization:
   - `feast -c ml/feast_repo apply`
6. Run training locally:
   - `python -m services.training_service.app.main`
7. Run smoke tests:
   - `.venv311\Scripts\python.exe -m unittest tests.test_smoke -v`

## Runtime Flow

- Ingestion requests use provider-specific adapters in `services/providers.py` to normalize raw API payloads into team, player, odds, injury, sentiment, and weather records.
- Normalized records are persisted through SQLAlchemy models in `services/models.py` using repository methods in `services/repositories.py`.
- League-aware dataset assembly happens in `ml/training/datasets.py`, with training profiles in `ml/training/league_configs.py`.
- Training writes real pickle artifacts under `artifacts/models` and persists run metadata in `model_training_runs`.
- Prediction serving loads the latest trained artifact through `ml/training/registry.py`; it falls back to the stub bundle only when no trained artifact exists yet.

## Security

- JWT authentication for APIs
- Redis-backed rate limiting
- Structured JSON logging
- Secrets via AWS Secrets Manager / Kubernetes secrets
- Role-based access for admin/model promotion endpoints

## Deployment

- Docker images per service
- Kubernetes manifests for API, stream, training, and monitoring
- Terraform modules for VPC, EKS, RDS PostgreSQL, Redis, S3, and GPU node groups
- GitHub Actions for lint, test, build, and deploy
