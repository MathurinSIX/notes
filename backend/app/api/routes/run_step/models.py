import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from ..run.models import Run


class RunStep(SQLModel, table=True):
    __tablename__ = "run_step"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    run_id: uuid.UUID = Field(foreign_key="run.id", ondelete="CASCADE")
    name: str
    description: str | None = None
    status: str
    duration: float | None = None
    llm: str | None = None
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    cached_tokens: int | None = None
    llm_cost: float | None = None
    logs: list[dict] | None = Field(default=None, sa_column=Column(JSONB))
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    run: "Run" = Relationship(back_populates="steps")
