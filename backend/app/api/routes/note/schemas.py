import uuid
from datetime import datetime
from typing import Literal

from pydantic import field_validator
from sqlmodel import Field, SQLModel


class NoteCreate(SQLModel):
    title: str | None = None
    summary: str | None = None


class NoteCreateInternal(SQLModel):
    """Row payload for repository create (creator from auth)."""

    title: str | None = None
    summary: str | None = None
    creator_id: uuid.UUID


class NoteUpdate(SQLModel):
    title: str | None = None
    summary: str | None = None
    archived: bool | None = None


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
    external_note_update_id: uuid.UUID | None = Field(
        default=None,
        description="Most recent external merge update linked to this section, if any.",
    )


class NoteTaskOut(SQLModel):
    id: uuid.UUID
    note_id: uuid.UUID
    title: str
    done: bool
    due_at: datetime | None = None
    sort_order: int
    updated_ts: datetime
    created_ts: datetime
    external_note_update_id: uuid.UUID | None = Field(
        default=None,
        description="Incoming merge update that introduced this follow-up, if known.",
    )
    source_update_created_ts: datetime | None = Field(
        default=None,
        description="When the linked incoming update was submitted (if loaded).",
    )
    source_update_preview: str | None = Field(
        default=None,
        description="First line of the linked incoming update body (if loaded).",
    )


class NoteTaskPatch(SQLModel):
    done: bool | None = None
    title: str | None = Field(default=None, max_length=4000)
    due_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def title_non_empty_when_set(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("title cannot be empty")
        return s


class NoteTaskMergeItem(SQLModel):
    """Structured task row from the merge LLM (also used as API schema for workflow output)."""

    existing_task_id: uuid.UUID | None = None
    title: str = Field(default="", max_length=4000)
    done: bool = False
    due_at: datetime | None = None
    sort_order: int = Field(default=0, ge=0)


class NoteOut(SQLModel):
    id: uuid.UUID
    title: str | None
    summary: str | None
    archived: bool
    full_markdown: str
    chunks: list[ChunkOut]
    tasks: list[NoteTaskOut]
    updated_ts: datetime
    created_ts: datetime


class Notes(SQLModel):
    id: uuid.UUID
    title: str | None
    summary: str | None
    archived: bool
    updated_ts: datetime
    created_ts: datetime
    pending_task_count: int = Field(
        default=0,
        description="Number of open (not done) follow-up tasks on this note.",
    )


class NextAction(SQLModel):
    """One follow-up task on an active note, for workspace prioritization."""

    note_id: uuid.UUID
    note_title: str | None = None
    task_id: uuid.UUID
    task_title: str
    due_at: datetime | None = None
    external_note_update_id: uuid.UUID | None = Field(
        default=None,
        description="Incoming merge update that introduced this follow-up, if known.",
    )
    source_update_created_ts: datetime | None = Field(
        default=None,
        description="When the linked incoming update was submitted (if loaded).",
    )
    source_update_preview: str | None = Field(
        default=None,
        description="First line of the linked incoming update body (if loaded).",
    )
    done_updated_ts: datetime | None = Field(
        default=None,
        description="When set, the task is done and this is when it was last updated (used in recent_done_actions).",
    )


class NotesOut(SQLModel):
    data: list[Notes]
    count: int
    next_actions: list[NextAction] = Field(
        default_factory=list,
        description="Open tasks on active notes, soonest due first (empty when listing archived).",
    )
    recent_done_actions: list[NextAction] = Field(
        default_factory=list,
        description="Done tasks on active notes, most recently completed first (empty when listing archived).",
    )


class NoteHistoryEvent(SQLModel):
    kind: Literal["note"] = "note"
    id: uuid.UUID
    changed_ts: datetime
    title: str | None
    summary: str | None
    archived: bool
    external_note_update_id: uuid.UUID | None = None


class ChunkHistoryEvent(SQLModel):
    kind: Literal["chunk"] = "chunk"
    id: uuid.UUID
    chunk_id: uuid.UUID
    changed_ts: datetime
    body_md: str
    sort_order: int
    due_at: datetime | None
    completed: bool
    deleted: bool
    external_note_update_id: uuid.UUID | None = None


class TaskHistoryEvent(SQLModel):
    kind: Literal["task"] = "task"
    id: uuid.UUID
    task_id: uuid.UUID
    changed_ts: datetime
    title: str
    done: bool
    due_at: datetime | None
    sort_order: int
    deleted: bool
    external_note_update_id: uuid.UUID | None = None


class NoteTimelineOut(SQLModel):
    events: list[NoteHistoryEvent | ChunkHistoryEvent | TaskHistoryEvent]
    total: int
    skip: int
    limit: int


class ChunkTimelineOut(SQLModel):
    """Paginated history rows for a single section (chunk)."""

    events: list[ChunkHistoryEvent]
    total: int
    skip: int
    limit: int


class ExternalNoteUpdateCreate(SQLModel):
    """Insert payload for a stored update row (workflow merges asynchronously)."""

    body_md: str
    creator_id: uuid.UUID
    status: str = "pending"


class ExternalNoteUpdatePatch(SQLModel):
    status: str | None = None
    matched_note_id: uuid.UUID | None = None
    error_message: str | None = None


class UpdateNotesWorkflowResponse(SQLModel):
    external_note_update_id: uuid.UUID


class ExternalNoteUpdateOut(SQLModel):
    id: uuid.UUID
    body_md: str
    status: str
    matched_note_id: uuid.UUID | None
    error_message: str | None
    created_ts: datetime
    updated_ts: datetime
    merged_ts: datetime | None = Field(
        default=None,
        description="When the merge finished; set when status is merged (row updated_ts at completion).",
    )
    matched_note_title: str | None = Field(
        default=None,
        description="Title of the note the update was applied to, when known.",
    )


class ExternalNoteUpdatesOut(SQLModel):
    data: list[ExternalNoteUpdateOut]


class ExternalNoteUpdatesPageOut(SQLModel):
    """Paginated list of updates submitted by the current user (all matched notes)."""

    data: list[ExternalNoteUpdateOut]
    count: int
