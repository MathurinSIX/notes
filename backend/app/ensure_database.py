"""Create the application Postgres database if it does not exist."""

import logging
import re

import psycopg
from psycopg import sql
from tenacity import after_log, before_log, retry, stop_after_attempt, wait_fixed

from app.core.config import settings

logger = logging.getLogger(__name__)

max_tries = 60 * 5  # 5 minutes
wait_seconds = 1

# NAMEDATALEN-1 in PostgreSQL; restrict to unproblematic identifiers for CREATE DATABASE.
_SAFE_DB_NAME = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,62}$")


def _maintenance_conninfo() -> str:
    return psycopg.conninfo.make_conninfo(
        host=settings.POSTGRES_SERVER,
        port=settings.POSTGRES_PORT,
        dbname="postgres",
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
    )


@retry(
    stop=stop_after_attempt(max_tries),
    wait=wait_fixed(wait_seconds),
    before=before_log(logger, logging.INFO),
    after=after_log(logger, logging.WARN),
)
def ensure_postgres_database_exists() -> None:
    db_name = settings.POSTGRES_DB
    if not _SAFE_DB_NAME.match(db_name):
        raise ValueError(
            "POSTGRES_DB must be 1-63 characters, start with a letter or underscore, "
            "and contain only ASCII letters, digits, and underscores so it can be created safely."
        )
    conninfo = _maintenance_conninfo()
    with psycopg.connect(conninfo) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (db_name,),
            )
            if cur.fetchone() is not None:
                logger.info("Database %s already exists", db_name)
                return
            logger.info("Creating database %s", db_name)
            cur.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)),
            )
