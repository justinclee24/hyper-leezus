FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:$PYTHONPATH

COPY infra/requirements ./infra/requirements
COPY services ./services
COPY ml ./ml

RUN pip install --no-cache-dir --upgrade "pip>=24.0" && \
    pip install --no-cache-dir -r infra/requirements/data-ingestion.txt

CMD ["python", "-m", "services.data_ingestion.run_once"]
