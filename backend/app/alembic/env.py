import os
import re
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool, text
from sqlmodel import SQLModel

# Load .env from project root before config - ensures POSTGRES_SCHEMA is available
# when Settings loads from a different project (e.g. risk-control venv) or env_file path is wrong
_env_path = Path(__file__).resolve().parents[3] / ".env"
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val

from app.api.routes.user.models import User  # noqa: F401 - register table
from app.api.routes.user_tokens.models import UserToken  # noqa: F401 - register table
from app.api.routes.run_step.models import RunStep  # noqa: F401 - register table
from app.api.routes.run.models import Run  # noqa: F401 - register table
from app.core.config import settings

config = context.config
POSTGRES_SCHEMA = getattr(settings, "POSTGRES_SCHEMA", os.environ.get("POSTGRES_SCHEMA", "public"))

if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def get_url():
    return str(settings.SQLALCHEMY_DATABASE_URI)


def run_migrations_offline():
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        version_table_schema=POSTGRES_SCHEMA if POSTGRES_SCHEMA != "public" else None,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    # Use bare engine first (no custom search_path) to create schema/version table.
    # Connecting with search_path=test when schema doesn't exist can cause issues.
    bare_engine = create_engine(get_url(), poolclass=pool.NullPool)
    if POSTGRES_SCHEMA != "public":
        schema = POSTGRES_SCHEMA
        # Allow hyphens (PostgreSQL requires quoted identifiers for them)
        if re.match(r"^[a-zA-Z_][a-zA-Z0-9_-]*$", schema):
            with bare_engine.connect() as conn:
                conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
                conn.execute(
                    text(
                        f'CREATE TABLE IF NOT EXISTS "{schema}".alembic_version '
                        '(version_num VARCHAR(32) NOT NULL PRIMARY KEY)'
                    )
                )
                conn.commit()

    # Quote schema in search_path when it contains hyphens (e.g. bootcamp-templates-fastapi_nextjs)
    _search_path = f'"{POSTGRES_SCHEMA}"' if "-" in POSTGRES_SCHEMA else POSTGRES_SCHEMA
    pg_options = f"-c statement_timeout=1200000 -c search_path={_search_path}"
    connectable = create_engine(
        get_url(),
        poolclass=pool.NullPool,
        connect_args={"options": pg_options},
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            version_table_schema=POSTGRES_SCHEMA if POSTGRES_SCHEMA != "public" else None,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
