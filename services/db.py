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
    # Safe migrations for columns/constraints added after initial deploy
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE IF EXISTS model_training_runs "
            "ADD COLUMN IF NOT EXISTS model_blob BYTEA"
        ))
        # Drop unique constraint on model_version so re-training runs never fail
        conn.execute(text(
            "ALTER TABLE IF EXISTS model_training_runs "
            "DROP CONSTRAINT IF EXISTS model_training_runs_model_version_key"
        ))
        # Also drop standalone unique index SQLAlchemy may have created under either naming convention
        conn.execute(text("DROP INDEX IF EXISTS ix_model_training_runs_model_version"))
        conn.execute(text("DROP INDEX IF EXISTS uq_model_training_runs_model_version"))
        conn.commit()
