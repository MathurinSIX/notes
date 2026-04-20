import uuid
from datetime import datetime

from sqlmodel import SQLModel


class NoteCreate(SQLModel):
    title: str | None = None


class NoteCreateInternal(SQLModel):
    """Row payload for repository create (creator from auth)."""

    title: str | None = None
    creator_id: uuid.UUID


class NoteUpdate(SQLModel):
    title: str | None = None


class ChunkCreate(SQLModel):
    body_md: str
    sort_order: int | None = None
    due_at: datetime | None = None
    completed: bool | None = None


class ChunkCreateInternal(SQLModel):
    note_id: uuid.UUID
    body_md: str
    sort_order: int
    due_at: datetime | None = None
    completed: bool = False


class ChunkUpdate(SQLModel):
    body_md: str | None = None
    sort_order: int | None = None
    due_at: datetime | None = None
    completed: bool | None = None


class ChunkOut(SQLModel):
    id: uuid.UUID
    note_id: uuid.UUID
    body_md: str
    sort_order: int
    due_at: datetime | None
    completed: bool
    updated_ts: datetime
    created_ts: datetime


class NoteOut(SQLModel):
    id: uuid.UUID
    title: str | None
    full_markdown: str
    chunks: list[ChunkOut]
    updated_ts: datetime
    created_ts: datetime


class Notes(SQLModel):
    id: uuid.UUID
    title: str | None
    updated_ts: datetime
    created_ts: datetime


class NotesOut(SQLModel):
    data: list[Notes]
    count: int
