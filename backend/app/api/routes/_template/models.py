import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlmodel import Field, SQLModel


if TYPE_CHECKING:
    pass


class {CLASSNAME}(SQLModel, table=True):
    __tablename__ = "{TABLENAME}"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
