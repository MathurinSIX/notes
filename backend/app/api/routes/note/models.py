import uuid
from datetime import datetime, timezone

from sqlmodel import Field, Relationship, SQLModel

from ..user.models import User


class ChunkDraftLink(SQLModel, table=True):
    __tablename__ = "chunk_draft_link"

    chunk_id: uuid.UUID = Field(foreign_key="chunk.id", primary_key=True, ondelete="CASCADE")
    draft_id: uuid.UUID = Field(foreign_key="draft.id", primary_key=True, ondelete="CASCADE")


class Note(SQLModel, table=True):
    __tablename__ = "note"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str | None = Field(default=None, max_length=500)
    creator_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    creator: User = Relationship()
    chunks: list["Chunk"] = Relationship(
        back_populates="note",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "Chunk.sort_order",
        },
    )


class Draft(SQLModel, table=True):
    __tablename__ = "draft"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    body_md: str = Field(default="")
    target_note_id: uuid.UUID | None = Field(
        default=None, foreign_key="note.id", ondelete="SET NULL"
    )
    due_at: datetime | None = None
    status: str = Field(default="open", max_length=32)
    merged_note_id: uuid.UUID | None = Field(
        default=None, foreign_key="note.id", ondelete="SET NULL"
    )
    creator_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    creator: User = Relationship()
    chunks: list["Chunk"] = Relationship(
        back_populates="drafts",
        link_model=ChunkDraftLink,
    )


class Chunk(SQLModel, table=True):
    __tablename__ = "chunk"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="note.id", ondelete="CASCADE")
    body_md: str = Field(default="")
    sort_order: int = Field(default=0)
    due_at: datetime | None = None
    completed: bool = Field(default=False)
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    note: Note = Relationship(back_populates="chunks")
    drafts: list["Draft"] = Relationship(
        back_populates="chunks",
        link_model=ChunkDraftLink,
    )
