import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    Text,
    asc,
    cast,
    false,
    func,
    literal,
    null,
    select,
    tuple_,
    union_all,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import selectinload
from sqlmodel import or_, select

from app.api.deps import CurrentUser, SessionDep
from app.api.routes._shared.repository import BaseRepository

from .models import (
    Chunk,
    ChunkHistory,
    ExternalNoteUpdate,
    Note,
    NoteHistory,
    NoteTask,
    NoteTaskHistory,
)
from .schemas import NoteTaskMergeItem, NoteTaskPatch


class NoteRepository(BaseRepository):
    model = Note
    options: list = []

    filters = {
        "archived": lambda values: Note.archived.in_(values),
    }

    async def read_titles_by_ids(
        self, ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, str | None]:
        if not ids:
            return {}
        stmt = select(Note.id, Note.title).where(
            Note.id.in_(ids),
            or_(
                self.current_user.is_superuser,
                self.rls_select(self.current_user.id),
            ),
        )
        result = await self.session.execute(stmt)
        return {row[0]: row[1] for row in result.all()}

    async def read_by_id(self, id: uuid.UUID, bypass_rls: bool = False):
        statement = (
            select(Note)
            .options(
                selectinload(Note.chunks),
                selectinload(Note.tasks),
            )
            .where(
                Note.id == id,
                True
                if bypass_rls
                else or_(
                    self.current_user.is_superuser,
                    self.rls_select(self.current_user.id),
                ),
            )
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=403)
        return record

    @staticmethod
    def rls_select(user_id):
        return Note.creator_id == user_id

    @staticmethod
    def rls_insert(user_id):
        return Note.creator_id == user_id

    @staticmethod
    def rls_update(user_id):
        return Note.creator_id == user_id

    @staticmethod
    def rls_delete(user_id):
        return Note.creator_id == user_id


NoteRepositoryDep = Annotated[NoteRepository, Depends(NoteRepository)]


class ChunkRepository(BaseRepository):
    model = Chunk
    options: list = []

    async def next_sort_order(self, note_id) -> int:
        stmt = select(func.coalesce(func.max(Chunk.sort_order), -1)).where(
            Chunk.note_id == note_id,
            or_(
                self.current_user.is_superuser,
                Chunk.note.has(Note.creator_id == self.current_user.id),
            ),
        )
        result = await self.session.execute(stmt)
        max_so = result.scalar_one()
        return int(max_so) + 1

    @staticmethod
    def rls_select(user_id):
        return Chunk.note.has(Note.creator_id == user_id)

    @staticmethod
    def rls_insert(user_id):
        return Chunk.note.has(Note.creator_id == user_id)

    @staticmethod
    def rls_update(user_id):
        return Chunk.note.has(Note.creator_id == user_id)

    @staticmethod
    def rls_delete(user_id):
        return Chunk.note.has(Note.creator_id == user_id)


ChunkRepositoryDep = Annotated[ChunkRepository, Depends(ChunkRepository)]


class ExternalNoteUpdateRepository(BaseRepository):
    model = ExternalNoteUpdate
    options: list = []

    async def list_by_matched_note_id(self, note_id: uuid.UUID) -> list[ExternalNoteUpdate]:
        stmt = (
            select(ExternalNoteUpdate)
            .where(
                ExternalNoteUpdate.matched_note_id == note_id,
                ExternalNoteUpdate.status != "undone",
                or_(
                    self.current_user.is_superuser,
                    self.rls_select(self.current_user.id),
                ),
            )
            .order_by(ExternalNoteUpdate.created_ts.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def read_for_matched_note(
        self, note_id: uuid.UUID, update_id: uuid.UUID
    ) -> ExternalNoteUpdate | None:
        stmt = (
            select(ExternalNoteUpdate)
            .where(
                ExternalNoteUpdate.id == update_id,
                ExternalNoteUpdate.matched_note_id == note_id,
                ExternalNoteUpdate.status != "undone",
                or_(
                    self.current_user.is_superuser,
                    self.rls_select(self.current_user.id),
                ),
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_creator(
        self, *, skip: int = 0, limit: int = 100
    ) -> tuple[list[ExternalNoteUpdate], int]:
        safe_skip = max(0, skip)
        safe_limit = max(1, min(limit, 200))
        base_where = or_(
            self.current_user.is_superuser,
            self.rls_select(self.current_user.id),
        )
        count_stmt = (
            select(func.count())
            .select_from(ExternalNoteUpdate)
            .where(base_where)
        )
        total = int(await self.session.scalar(count_stmt) or 0)
        stmt = (
            select(ExternalNoteUpdate)
            .where(base_where)
            .order_by(ExternalNoteUpdate.created_ts.desc())
            .offset(safe_skip)
            .limit(safe_limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def read_by_ids(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, ExternalNoteUpdate]:
        """Return updates the current user may see (creator RLS), keyed by id."""
        if not ids:
            return {}
        stmt = select(ExternalNoteUpdate).where(
            ExternalNoteUpdate.id.in_(ids),
            or_(
                self.current_user.is_superuser,
                self.rls_select(self.current_user.id),
            ),
        )
        result = await self.session.execute(stmt)
        return {row.id: row for row in result.scalars().all()}

    @staticmethod
    def rls_select(user_id):
        return ExternalNoteUpdate.creator_id == user_id

    @staticmethod
    def rls_insert(user_id):
        return ExternalNoteUpdate.creator_id == user_id

    @staticmethod
    def rls_update(user_id):
        return ExternalNoteUpdate.creator_id == user_id

    @staticmethod
    def rls_delete(user_id):
        return ExternalNoteUpdate.creator_id == user_id


ExternalNoteUpdateRepositoryDep = Annotated[
    ExternalNoteUpdateRepository, Depends(ExternalNoteUpdateRepository)
]


class NoteTaskRepository(BaseRepository):
    model = NoteTask
    options: list = []

    async def sync_from_merge_plan(
        self,
        note_id: uuid.UUID,
        items: list[NoteTaskMergeItem],
        *,
        source_external_note_update_id: uuid.UUID | None = None,
        timeline: "NoteTimelineRepository | None" = None,
        editor_id: uuid.UUID | None = None,
    ) -> None:
        stmt = select(NoteTask).where(
            NoteTask.note_id == note_id,
            or_(
                self.current_user.is_superuser,
                NoteTask.note.has(Note.creator_id == self.current_user.id),
            ),
        )
        result = await self.session.execute(stmt)
        existing = list(result.scalars().all())
        by_id = {str(t.id): t for t in existing}
        kept: set[str] = set()
        for p in sorted(items, key=lambda x: x.sort_order):
            title = (p.title or "").strip()
            if not title:
                continue
            if p.existing_task_id and str(p.existing_task_id) in by_id:
                tid = p.existing_task_id
                row = by_id[str(tid)]
                row.title = title
                row.done = p.done
                row.sort_order = p.sort_order
                row.due_at = p.due_at
                if (
                    source_external_note_update_id is not None
                    and row.external_note_update_id is None
                ):
                    row.external_note_update_id = source_external_note_update_id
                row.updated_ts = datetime.now(timezone.utc)
                self.session.add(row)
                await self.session.flush()
                kept.add(str(tid))
                if timeline:
                    await timeline.record_task_snapshot(
                        note_id=note_id,
                        task_id=row.id,
                        title=row.title,
                        done=row.done,
                        due_at=row.due_at,
                        sort_order=row.sort_order,
                        deleted=False,
                        editor_id=editor_id,
                        external_note_update_id=source_external_note_update_id,
                    )
            else:
                row = NoteTask(
                    note_id=note_id,
                    title=title,
                    done=p.done,
                    due_at=p.due_at,
                    sort_order=p.sort_order,
                    external_note_update_id=source_external_note_update_id,
                )
                self.session.add(row)
                await self.session.flush()
                by_id[str(row.id)] = row
                kept.add(str(row.id))
                if timeline:
                    await timeline.record_task_snapshot(
                        note_id=note_id,
                        task_id=row.id,
                        title=row.title,
                        done=row.done,
                        due_at=row.due_at,
                        sort_order=row.sort_order,
                        deleted=False,
                        editor_id=editor_id,
                        external_note_update_id=source_external_note_update_id,
                    )
        for t in existing:
            if str(t.id) not in kept:
                if timeline:
                    await timeline.record_task_snapshot(
                        note_id=note_id,
                        task_id=t.id,
                        title=t.title,
                        done=t.done,
                        due_at=t.due_at,
                        sort_order=t.sort_order,
                        deleted=True,
                        editor_id=editor_id,
                        external_note_update_id=source_external_note_update_id,
                    )
                await self.session.delete(t)
        await self.session.commit()

    async def update_for_note(
        self,
        note_id: uuid.UUID,
        task_id: uuid.UUID,
        data: NoteTaskPatch,
    ) -> NoteTask:
        task = await self.read_by_id(task_id)
        if task.note_id != note_id:
            raise HTTPException(status_code=404, detail="Task not found")
        patch = data.model_dump(exclude_unset=True)
        if "done" in patch and patch.get("done") is None:
            patch.pop("done", None)
        if not patch:
            raise HTTPException(
                status_code=422,
                detail="No fields to update",
            )
        return await self.update(task_id, NoteTaskPatch.model_validate(patch))

    async def count_open_tasks_by_note_ids(
        self, note_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        if not note_ids:
            return {}
        stmt = (
            select(NoteTask.note_id, func.count().label("cnt"))
            .join(Note, NoteTask.note_id == Note.id)
            .where(
                NoteTask.note_id.in_(note_ids),
                NoteTask.done.is_(False),
                or_(
                    self.current_user.is_superuser,
                    Note.creator_id == self.current_user.id,
                ),
            )
            .group_by(NoteTask.note_id)
        )
        result = await self.session.execute(stmt)
        return {row[0]: int(row[1]) for row in result.all()}

    async def list_next_open_tasks(self, limit: int = 12) -> list[tuple[NoteTask, Note]]:
        stmt = (
            select(NoteTask, Note)
            .join(Note, NoteTask.note_id == Note.id)
            .where(
                NoteTask.done.is_(False),
                Note.archived.is_(False),
                or_(
                    self.current_user.is_superuser,
                    Note.creator_id == self.current_user.id,
                ),
            )
            .order_by(
                NoteTask.due_at.asc().nulls_last(),
                asc(NoteTask.sort_order),
                asc(NoteTask.created_ts),
            )
            .limit(max(1, min(limit, 50)))
        )
        result = await self.session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def list_recent_done_tasks(self, limit: int = 24) -> list[tuple[NoteTask, Note]]:
        stmt = (
            select(NoteTask, Note)
            .join(Note, NoteTask.note_id == Note.id)
            .where(
                NoteTask.done.is_(True),
                Note.archived.is_(False),
                or_(
                    self.current_user.is_superuser,
                    Note.creator_id == self.current_user.id,
                ),
            )
            .order_by(
                NoteTask.updated_ts.desc(),
                NoteTask.created_ts.desc(),
            )
            .limit(max(1, min(limit, 50)))
        )
        result = await self.session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def earliest_external_note_update_ids_for_task_keys(
        self,
        keys: list[tuple[uuid.UUID, uuid.UUID]],
    ) -> dict[tuple[uuid.UUID, uuid.UUID], uuid.UUID]:
        """First merge-linked snapshot per (note_id, task_id), for tasks missing ext id on the row."""
        if not keys:
            return {}
        uniq = list(dict.fromkeys(keys))
        ranked = (
            select(
                NoteTaskHistory.note_id,
                NoteTaskHistory.task_id,
                NoteTaskHistory.external_note_update_id,
                func.row_number()
                .over(
                    partition_by=(
                        NoteTaskHistory.note_id,
                        NoteTaskHistory.task_id,
                    ),
                    order_by=NoteTaskHistory.changed_ts.asc(),
                )
                .label("rn"),
            )
            .join(Note, Note.id == NoteTaskHistory.note_id)
            .where(
                tuple_(NoteTaskHistory.note_id, NoteTaskHistory.task_id).in_(uniq),
                NoteTaskHistory.external_note_update_id.is_not(None),
                or_(
                    self.current_user.is_superuser,
                    Note.creator_id == self.current_user.id,
                ),
            )
        ).subquery()
        stmt = select(
            ranked.c.note_id,
            ranked.c.task_id,
            ranked.c.external_note_update_id,
        ).where(ranked.c.rn == 1)
        result = await self.session.execute(stmt)
        return {
            (row[0], row[1]): row[2]
            for row in result.all()
            if row[2] is not None
        }

    @staticmethod
    def rls_select(user_id):
        return NoteTask.note.has(Note.creator_id == user_id)

    @staticmethod
    def rls_insert(user_id):
        return NoteTask.note.has(Note.creator_id == user_id)

    @staticmethod
    def rls_update(user_id):
        return NoteTask.note.has(Note.creator_id == user_id)

    @staticmethod
    def rls_delete(user_id):
        return NoteTask.note.has(Note.creator_id == user_id)


NoteTaskRepositoryDep = Annotated[NoteTaskRepository, Depends(NoteTaskRepository)]


class NoteTimelineRepository:
    """Append-only history rows and merged timeline reads (RLS via parent note)."""

    def __init__(self, session, current_user) -> None:
        self.session = session
        self.current_user = current_user

    async def _ensure_note_access(self, note_id: uuid.UUID) -> None:
        stmt = select(Note.id).where(
            Note.id == note_id,
            or_(
                self.current_user.is_superuser,
                Note.creator_id == self.current_user.id,
            ),
        )
        result = await self.session.execute(stmt)
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=403)

    async def record_note_snapshot(
        self,
        *,
        note_id: uuid.UUID,
        title: str | None,
        description: str | None,
        archived: bool,
        editor_id: uuid.UUID | None,
        changed_ts: datetime | None = None,
        external_note_update_id: uuid.UUID | None = None,
    ) -> None:
        await self._ensure_note_access(note_id)
        row = NoteHistory(
            note_id=note_id,
            editor_id=editor_id,
            external_note_update_id=external_note_update_id,
            changed_ts=changed_ts or datetime.now(timezone.utc),
            title=title,
            description=description,
            archived=archived,
        )
        self.session.add(row)
        await self.session.commit()

    async def record_chunk_snapshot(
        self,
        *,
        note_id: uuid.UUID,
        chunk_id: uuid.UUID,
        body_md: str,
        sort_order: int,
        due_at: datetime | None,
        completed: bool,
        deleted: bool,
        editor_id: uuid.UUID | None,
        changed_ts: datetime | None = None,
        external_note_update_id: uuid.UUID | None = None,
    ) -> None:
        await self._ensure_note_access(note_id)
        row = ChunkHistory(
            note_id=note_id,
            chunk_id=chunk_id,
            editor_id=editor_id,
            external_note_update_id=external_note_update_id,
            changed_ts=changed_ts or datetime.now(timezone.utc),
            body_md=body_md,
            sort_order=sort_order,
            due_at=due_at,
            completed=completed,
            deleted=deleted,
        )
        self.session.add(row)
        await self.session.commit()

    async def record_task_snapshot(
        self,
        *,
        note_id: uuid.UUID,
        task_id: uuid.UUID,
        title: str,
        done: bool,
        due_at: datetime | None,
        sort_order: int,
        deleted: bool,
        editor_id: uuid.UUID | None,
        changed_ts: datetime | None = None,
        external_note_update_id: uuid.UUID | None = None,
    ) -> None:
        await self._ensure_note_access(note_id)
        row = NoteTaskHistory(
            note_id=note_id,
            task_id=task_id,
            editor_id=editor_id,
            external_note_update_id=external_note_update_id,
            changed_ts=changed_ts or datetime.now(timezone.utc),
            title=title,
            done=done,
            due_at=due_at,
            sort_order=sort_order,
            deleted=deleted,
        )
        self.session.add(row)
        await self.session.commit()

    async def list_timeline(
        self, note_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[dict], int]:
        """Merged note, chunk, and task history, newest first, with total count."""
        await self._ensure_note_access(note_id)
        safe_limit = max(1, min(limit, 200))
        safe_skip = max(0, skip)

        note_rows = select(
            literal("note", type_=Text).label("kind"),
            NoteHistory.id,
            NoteHistory.changed_ts,
            cast(null(), PG_UUID(as_uuid=True)).label("chunk_id"),
            cast(null(), PG_UUID(as_uuid=True)).label("task_id"),
            NoteHistory.title,
            NoteHistory.description,
            NoteHistory.archived,
            cast(literal(""), Text).label("body_md"),
            cast(literal(0), Integer).label("sort_order"),
            cast(null(), DateTime(timezone=True)).label("due_at"),
            cast(false(), Boolean).label("completed"),
            cast(false(), Boolean).label("deleted"),
            NoteHistory.external_note_update_id,
        ).where(NoteHistory.note_id == note_id)

        chunk_rows = select(
            literal("chunk", type_=Text).label("kind"),
            ChunkHistory.id,
            ChunkHistory.changed_ts,
            ChunkHistory.chunk_id,
            cast(null(), PG_UUID(as_uuid=True)).label("task_id"),
            cast(null(), Text).label("title"),
            cast(null(), Text).label("description"),
            cast(false(), Boolean).label("archived"),
            ChunkHistory.body_md,
            ChunkHistory.sort_order,
            ChunkHistory.due_at,
            ChunkHistory.completed,
            ChunkHistory.deleted,
            ChunkHistory.external_note_update_id,
        ).where(ChunkHistory.note_id == note_id)

        task_rows = select(
            literal("task", type_=Text).label("kind"),
            NoteTaskHistory.id,
            NoteTaskHistory.changed_ts,
            cast(null(), PG_UUID(as_uuid=True)).label("chunk_id"),
            NoteTaskHistory.task_id,
            NoteTaskHistory.title,
            cast(null(), Text).label("description"),
            cast(false(), Boolean).label("archived"),
            cast(literal(""), Text).label("body_md"),
            NoteTaskHistory.sort_order,
            NoteTaskHistory.due_at,
            NoteTaskHistory.done.label("completed"),
            NoteTaskHistory.deleted,
            NoteTaskHistory.external_note_update_id,
        ).where(NoteTaskHistory.note_id == note_id)

        combined = union_all(note_rows, chunk_rows, task_rows).subquery("timeline")

        count_stmt = select(func.count()).select_from(combined)
        total = int(await self.session.scalar(count_stmt) or 0)

        page_stmt = (
            select(combined)
            .order_by(combined.c.changed_ts.desc(), combined.c.id.desc())
            .offset(safe_skip)
            .limit(safe_limit)
        )
        result = await self.session.execute(page_stmt)
        rows = result.mappings().all()

        events: list[dict] = []
        for r in rows:
            if r["kind"] == "note":
                events.append(
                    {
                        "kind": "note",
                        "id": r["id"],
                        "changed_ts": r["changed_ts"],
                        "title": r["title"],
                        "description": r["description"],
                        "archived": r["archived"],
                        "external_note_update_id": r["external_note_update_id"],
                    }
                )
            elif r["kind"] == "task":
                events.append(
                    {
                        "kind": "task",
                        "id": r["id"],
                        "task_id": r["task_id"],
                        "changed_ts": r["changed_ts"],
                        "title": r["title"],
                        "done": r["completed"],
                        "due_at": r["due_at"],
                        "sort_order": r["sort_order"],
                        "deleted": r["deleted"],
                        "external_note_update_id": r["external_note_update_id"],
                    }
                )
            else:
                events.append(
                    {
                        "kind": "chunk",
                        "id": r["id"],
                        "chunk_id": r["chunk_id"],
                        "changed_ts": r["changed_ts"],
                        "body_md": r["body_md"],
                        "sort_order": r["sort_order"],
                        "due_at": r["due_at"],
                        "completed": r["completed"],
                        "deleted": r["deleted"],
                        "external_note_update_id": r["external_note_update_id"],
                    }
                )
        return events, total, safe_skip, safe_limit

    async def list_chunk_timeline(
        self,
        note_id: uuid.UUID,
        chunk_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int, int, int]:
        """History for one chunk (includes rows after the section was deleted)."""
        await self._ensure_note_access(note_id)
        safe_limit = max(1, min(limit, 200))
        safe_skip = max(0, skip)

        filters = (
            ChunkHistory.note_id == note_id,
            ChunkHistory.chunk_id == chunk_id,
        )
        count_stmt = select(func.count()).select_from(ChunkHistory).where(*filters)
        total = int(await self.session.scalar(count_stmt) or 0)

        stmt = (
            select(ChunkHistory)
            .where(*filters)
            .order_by(ChunkHistory.changed_ts.desc(), ChunkHistory.id.desc())
            .offset(safe_skip)
            .limit(safe_limit)
        )
        result = await self.session.execute(stmt)
        rows = result.scalars().all()

        events: list[dict] = []
        for r in rows:
            events.append(
                {
                    "kind": "chunk",
                    "id": r.id,
                    "chunk_id": r.chunk_id,
                    "changed_ts": r.changed_ts,
                    "body_md": r.body_md,
                    "sort_order": r.sort_order,
                    "due_at": r.due_at,
                    "completed": r.completed,
                    "deleted": r.deleted,
                    "external_note_update_id": r.external_note_update_id,
                }
            )
        return events, total, safe_skip, safe_limit

    async def latest_external_note_update_ids_for_chunks(
        self,
        note_id: uuid.UUID,
        chunk_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, uuid.UUID]:
        """Per chunk, the update id from the newest history row that recorded one."""
        await self._ensure_note_access(note_id)
        if not chunk_ids:
            return {}
        stmt = (
            select(ChunkHistory.chunk_id, ChunkHistory.external_note_update_id)
            .where(
                ChunkHistory.note_id == note_id,
                ChunkHistory.chunk_id.in_(chunk_ids),
                ChunkHistory.external_note_update_id.is_not(None),
            )
            .distinct(ChunkHistory.chunk_id)
            .order_by(
                ChunkHistory.chunk_id,
                ChunkHistory.changed_ts.desc(),
                ChunkHistory.id.desc(),
            )
        )
        result = await self.session.execute(stmt)
        return {row[0]: row[1] for row in result.all()}

    async def distinct_external_note_update_ids_for_chunk(
        self,
        note_id: uuid.UUID,
        chunk_id: uuid.UUID,
    ) -> set[uuid.UUID]:
        """Incoming update ids ever recorded on this section's history (merge sources)."""
        await self._ensure_note_access(note_id)
        stmt = (
            select(ChunkHistory.external_note_update_id)
            .where(
                ChunkHistory.note_id == note_id,
                ChunkHistory.chunk_id == chunk_id,
                ChunkHistory.external_note_update_id.is_not(None),
            )
            .distinct()
        )
        result = await self.session.execute(stmt)
        return {row[0] for row in result.all()}


def get_note_timeline_repository(
    session: SessionDep,
    current_user: CurrentUser,
) -> NoteTimelineRepository:
    return NoteTimelineRepository(session, current_user)


NoteTimelineRepositoryDep = Annotated[
    NoteTimelineRepository, Depends(get_note_timeline_repository)
]
