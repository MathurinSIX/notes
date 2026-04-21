import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel


class PastedImage(SQLModel, table=True):
    __tablename__ = "pasted_image"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    object_key: str = Field(max_length=1024, sa_column=Column(String(1024), nullable=False))
    content_type: str = Field(max_length=255, sa_column=Column(String(255), nullable=False))
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
