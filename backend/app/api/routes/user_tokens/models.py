import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class UserToken(SQLModel, table=True):
    __tablename__ = "user_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    name: str = Field(max_length=100)
    token: str = Field(max_length=512)
    is_active: bool = True
    deleted: bool = False
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
