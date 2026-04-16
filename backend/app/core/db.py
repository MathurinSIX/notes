try:  # psycopg async helper may not exist in older pgvector versions
    from pgvector.psycopg import (  # type: ignore
        register_vector_async as register_vector_psycopg_async,
    )
except Exception:  # pragma: no cover - best-effort import
    register_vector_psycopg_async = None  # type: ignore[assignment]
try:  # asyncpg support is optional depending on driver in use
    from pgvector.asyncpg import (
        register_vector as register_vector_asyncpg,  # type: ignore
    )
except Exception:  # pragma: no cover
    register_vector_asyncpg = None  # type: ignore[assignment]
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import Session, create_engine, select

from app.api.routes.user.models import User
from app.core.config import settings

# Quote schema in search_path when it contains hyphens (e.g. bootcamp-templates-fastapi_nextjs)
_schema = settings.POSTGRES_SCHEMA
_search_path = f'"{_schema}"' if "-" in _schema else _schema
_pg_options = f"-c statement_timeout=1200000 -c search_path={_search_path}"

engine = create_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    pool_pre_ping=True,
    connect_args={
        "options": _pg_options
    },
)
async_engine = create_async_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=20,
    connect_args={
        "options": _pg_options
    },
)