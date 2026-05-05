FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:$PYTHONPATH

ARG SERVICE=prediction-api

COPY infra/requirements ./infra/requirements
COPY services ./services
COPY ml ./ml
COPY *.py ./

RUN pip install --no-cache-dir --upgrade "pip>=24.0" && \
    pip install --no-cache-dir -r infra/requirements/${SERVICE}.txt

CMD ["uvicorn", "services.prediction_api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
