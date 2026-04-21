import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Text
from sqlmodel import Field, Relationship, SQLModel

from ..user.models import User


class ChunkDraftLink(SQLModel, table=True):
    __tablename__ = "chunk_draft_link"

    chunk_id: uuid.UUID = Field(foreign_key="chunk.id", primary_key=True, ondelete="CASCADE")
    draft_id: uuid.UUID = Field(foreign_key="draft.id", primary_key=True, ondelete="CASCADE")


class ExternalNoteUpdate(SQLModel, table=True):
    """Free-form text submitted from the client to merge into the best-matching note."""

    __tablename__ = "external_note_update"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    body_md: str = Field(default="", sa_column=Column(Text, nullable=False))
    creator_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    matched_note_id: uuid.UUID | None = Field(
        default=None, foreign_key="note.id", ondelete="SET NULL"
    )
    status: str = Field(default="pending", max_length=32)
    error_message: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    creator: User = Relationship()


class Note(SQLModel, table=True):
    __tablename__ = "note"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str | None = Field(default=None, max_length=500)
    summary: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    archived: bool = Field(default=False)
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
    tasks: list["NoteTask"] = Relationship(
        back_populates="note",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "NoteTask.sort_order",
        },
    )


class NoteTask(SQLModel, table=True):
    """Follow-up items suggested by merge workflow; user can check off in the app."""

    __tablename__ = "note_task"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="note.id", ondelete="CASCADE")
    title: str = Field(default="", sa_column=Column(Text, nullable=False))
    done: bool = Field(default=False)
    due_at: datetime | None = None
    external_note_update_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="external_note_update.id",
        ondelete="SET NULL",
    )
    sort_order: int = Field(default=0)
    updated_ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    note: Note = Relationship(back_populates="tasks")


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


class NoteHistory(SQLModel, table=True):
    """Append-only snapshots when note title, summary, or archive state changes."""

    __tablename__ = "note_history"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="note.id", ondelete="CASCADE")
    editor_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    external_note_update_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="external_note_update.id",
        ondelete="SET NULL",
    )
    changed_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    title: str | None = Field(default=None, max_length=500)
    summary: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    archived: bool = Field(default=False)


class ChunkHistory(SQLModel, table=True):
    """Append-only snapshots when a chunk is created, updated, or deleted."""

    __tablename__ = "chunk_history"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="note.id", ondelete="CASCADE")
    chunk_id: uuid.UUID
    editor_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    external_note_update_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="external_note_update.id",
        ondelete="SET NULL",
    )
    changed_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    body_md: str = Field(default="")
    sort_order: int = Field(default=0)
    due_at: datetime | None = None
    completed: bool = Field(default=False)
    deleted: bool = Field(default=False)


class NoteTaskHistory(SQLModel, table=True):
    """Append-only snapshots when a follow-up task is created, updated, or removed."""

    __tablename__ = "note_task_history"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    note_id: uuid.UUID = Field(foreign_key="note.id", ondelete="CASCADE")
    task_id: uuid.UUID
    editor_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    external_note_update_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="external_note_update.id",
        ondelete="SET NULL",
    )
    changed_ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    title: str = Field(default="", sa_column=Column(Text, nullable=False))
    done: bool = Field(default=False)
    due_at: datetime | None = None
    sort_order: int = Field(default=0)
    deleted: bool = Field(default=False)
