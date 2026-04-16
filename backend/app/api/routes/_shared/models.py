import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class BaseModel(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
