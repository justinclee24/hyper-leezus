from __future__ import annotations

from contextlib import contextmanager
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from services.shared import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.postgres_dsn, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False, autocommit=False)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    from services.models import Base as ModelBase
    from sqlalchemy import text

    ModelBase.metadata.create_all(bind=engine)
    # Safe migration: add model_blob column to tables that predate it
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE IF EXISTS model_training_runs "
            "ADD COLUMN IF NOT EXISTS model_blob BYTEA"
        ))
        conn.commit()
