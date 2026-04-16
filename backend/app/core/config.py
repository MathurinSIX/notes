import uuid
import logging
from contextvars import ContextVar
import warnings
from pathlib import Path
from typing import Annotated, Any

from pydantic import (
    AnyUrl,
    BeforeValidator,
    PostgresDsn,
    computed_field,
    model_validator,
)
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Self
from uvicorn.logging import ColourizedFormatter


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


def _settings_env_files() -> tuple[str, ...] | None:
    """Backend package lives in <repo>/backend/app/…; prefer backend/.env then repo root .env.

    In Docker only ./backend is mounted at /app, so parent/.env is usually missing and
    Compose-injected env vars are used (see docker-compose environment / env_file).
    """
    backend_root = Path(__file__).resolve().parents[2]
    paths = [p for p in (backend_root / ".env", backend_root.parent / ".env") if p.is_file()]
    return tuple(str(p) for p in paths) or None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_settings_env_files(),
        env_ignore_empty=True,
        extra="ignore",
    )

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    FRONTEND_HOST: str = "http://localhost:3000"

    # Environment: local, staging, production
    LOG_LEVEL: str = "INFO"

    # Authentication
    BACKEND_CORS_ORIGINS: Annotated[list[AnyUrl] | str, BeforeValidator(parse_cors)] = (
        "http://localhost:3000"
    )
    SECRET_KEY: str = "changethis"

    # Seed superuser (created on prestart if no user with this email exists).
    # Password must be set in the environment (e.g. .env); no default secret.
    FIRST_SUPERUSER_EMAIL: str = "admin@localhost"
    FIRST_SUPERUSER_PASSWORD: str | None = None

    HOSTNAME: str | None = None

    # Object storage (MinIO / S3 locally; set PROVIDER_CREDENTIALS for native GCS client)
    BUCKET_URL: str = "http://localhost:9000"
    BUCKET_NAME: str = "music-generator"
    BUCKET_PREFIX: str = ""
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_SECRET_ACCESS_KEY: str = "minioadmin"
    S3_REGION_NAME: str = "us-east-1"

    # Postgres
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "music-generator"
    POSTGRES_PASSWORD: str = "changethis"
    POSTGRES_DB: str = "public"
    POSTGRES_SCHEMA: str = "public"

    # API keys
    OPENAI_API_KEY: str | None = None

    # Computed fields
    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [
            self.FRONTEND_HOST,
        ]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        return MultiHostUrl.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def PG_DATABASE_URI(self) -> PostgresDsn:
        return MultiHostUrl.build(
            scheme="postgresql",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    # Validators
    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = f'The value of {var_name} is "changethis", '
            warnings.warn(message, stacklevel=1)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)

        return self

    @model_validator(mode="after")
    def _derive_from_hostname(self) -> Self:
        """Derive FRONTEND_HOST and BACKEND_CORS_ORIGINS from HOSTNAME."""
        if not self.HOSTNAME:
            return self
        scheme = "https"
        frontend_hostname = self.HOSTNAME
        derived_frontend = f"{scheme}://{frontend_hostname}"
        if self.FRONTEND_HOST == "http://localhost:3000":
            object.__setattr__(self, "FRONTEND_HOST", derived_frontend)
        default_cors = ["http://localhost:3000"]
        current = self.BACKEND_CORS_ORIGINS
        origins_list = (
            [str(o) for o in current]
            if isinstance(current, list)
            else [i.strip() for i in str(current).split(",")]
        )
        if origins_list == default_cors:
            object.__setattr__(self, "BACKEND_CORS_ORIGINS", derived_frontend)
        return self


run_id_var: ContextVar[uuid.UUID | str] = ContextVar("run_id", default=None)


class WorkflowContextFilter(logging.Filter):
    def __init__(self, run_id_var: ContextVar):
        super().__init__()
        self.run_id_var = run_id_var

    def filter(self, record):
        wf = run_id_var.get()
        record.run_id = f" [WF:{wf}]" if wf else ""
        return True


async def setup_logging():
    root_logger = logging.getLogger()

    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)

    root_logger.setLevel(settings.LOG_LEVEL)
    handler = logging.StreamHandler()

    formatter = ColourizedFormatter(
        "{levelprefix} @ {asctime} : {message}",
        style="{",
        datefmt="%Y-%m-%d %H:%M:%S",
        use_colors=True,
    )

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)


settings = Settings()  # type: ignore
