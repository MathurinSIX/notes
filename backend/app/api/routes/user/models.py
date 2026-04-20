import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # DB column remains ``email`` from the initial migration; API and code use ``username``.
    username: str = Field(
        max_length=255,
        sa_column=Column("email", String(255), nullable=False, unique=True),
    )
    hashed_password: str | None = Field(default=None, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
