import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, Relationship, SQLModel

from ..user.models import User
from app.api.routes.run_step.models import RunStep


class Run(SQLModel, table=True):
    __tablename__ = "run"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=200)
    workflow: str
    params: dict | None = Field(sa_column=Column(JSONB))
    output: dict | None = Field(sa_column=Column(JSONB))
    status: str
    pid: int | None = None
    duration: float | None = None
    total_steps: int | None = None
    deleted: bool = Field(default=False, sa_column_kwargs={"default": False})
    creator_id: uuid.UUID | None = Field(
        foreign_key="user.id", nullable=True, ondelete="SET NULL"
    )
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    created_by: User = Relationship()
    pod_name: str
    prestop_ts: datetime | None = Field(default=None, nullable=True)
    prestop_flag: bool = Field(default=False)
    steps: list[RunStep] = Relationship(back_populates="run")
