FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:$PYTHONPATH

ARG SERVICE=prediction-api
ARG PORT=8000

ENV SERVICE=${SERVICE}
ENV PORT=${PORT}

COPY infra/requirements ./infra/requirements
COPY services ./services
COPY ml ./ml

RUN pip install --no-cache-dir --upgrade "pip>=24.0" && \
    pip install --no-cache-dir -r infra/requirements/${SERVICE}.txt

CMD uvicorn services.$(echo $SERVICE | tr '-' '_').app.main:app --host 0.0.0.0 --port $PORT
