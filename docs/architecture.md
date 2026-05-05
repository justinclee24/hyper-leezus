# Platform Design

## Services

- Ingestion service pulls sports stats, odds, injuries, social sentiment, and weather into S3 and Kafka.
- Provider adapters normalize raw payloads into typed domain records before database persistence.
- Feature pipeline computes rolling team/player/context/market features and writes Feast-backed stores.
- Training service retrains weekly and after final scores, performs Optuna search, assembles league-specific datasets from persisted records, and logs metrics to MLflow.
- Prediction API serves authenticated predictions and explanations with rate limiting, persisting each prediction for downstream monitoring.
- Real-time streaming service pushes live prediction deltas over WebSockets.
- Monitoring service measures accuracy, calibration, drift, and betting ROI.

## Modeling Strategy

- Tree-based models: XGBoost, LightGBM, Random Forest for tabular matchup features.
- Deep models: feed-forward nets and LSTMs for sequential momentum and live-state updates.
- Bayesian models: prior/posterior estimates for robust sparse-league scenarios and injury uncertainty.
- Graph neural nets: player interaction and lineup synergy modeling.
- Ensemble layer: stacking with market priors and calibrated blending to produce final pregame/live outputs.
- Current training path uses persisted matchup features to fit a classifier plus home/away score regressors per league, with trained artifacts loaded directly by the prediction API.

## Data Domains

- Team features: efficiency, pace, home/away strength, rolling form, travel fatigue.
- Player features: usage, PER, synergy, injury-adjusted lineups, on/off impact.
- Context features: rest, altitude, back-to-backs, weather, playoff pressure.
- Market features: line movement, implied probabilities, public/sharp split.
- Sentiment features: social NLP polarity, volume, breaking-news shock score.
