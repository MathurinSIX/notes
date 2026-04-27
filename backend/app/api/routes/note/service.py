import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import Depends, HTTPException

from app.api.deps import CurrentUser
from app.api.routes._shared.service import BaseService

from .merge_undo import (
    chunk_merge_boundaries,
    note_merge_boundaries,
    task_merge_boundaries,
    verify_merge_undoable,
)
from .models import Chunk, NoteTask
from .repository import (
    ChunkRepositoryDep,
    ExternalNoteUpdateRepositoryDep,
    NoteRepositoryDep,
    NoteTaskRepositoryDep,
    NoteTimelineRepositoryDep,
)
from .schemas import (
    ChunkCreate,
    ChunkCreateInternal,
    ChunkHistoryEvent,
    ChunkOut,
    ChunkTimelineOut,
    ChunkUpdate,
    NoteCreate,
    NoteCreateInternal,
    ExternalNoteUpdateOut,
    ExternalNoteUpdatePatch,
    ExternalNoteUpdatesOut,
    ExternalNoteUpdatesPageOut,
    NextAction,
    NoteHistoryEvent,
    NoteOut,
    Notes,
    NotesOut,
    NoteTaskOut,
    NoteTaskPatch,
    NoteTimelineOut,
    NoteUpdate,
    TaskHistoryEvent,
)
from .utils import join_chunks_markdown


def _external_note_update_out(
    r,
    *,
    matched_note_title: str | None = None,
) -> ExternalNoteUpdateOut:
    return ExternalNoteUpdateOut(
        id=r.id,
        body_md=r.body_md,
        status=r.status,
        matched_note_id=r.matched_note_id,
        error_message=r.error_message,
        created_ts=r.created_ts,
        updated_ts=r.updated_ts,
        merged_ts=r.updated_ts if r.status == "merged" else None,
        matched_note_title=matched_note_title,
    )


def _incoming_update_preview(body_md: str | None, *, max_len: int = 140) -> str:
    if not body_md:
        return ""
    first = body_md.strip().split("\n", 1)[0].strip()
    if len(first) > max_len:
        return f"{first[: max_len - 1]}…"
    return first


def _chunk_out(
    chunk,
    *,
    external_note_update_id: uuid.UUID | None = None,
) -> ChunkOut:
    return ChunkOut(
        id=chunk.id,
        note_id=chunk.note_id,
        body_md=chunk.body_md,
        sort_order=chunk.sort_order,
        due_at=chunk.due_at,
        completed=chunk.completed,
        updated_ts=chunk.updated_ts,
        created_ts=chunk.created_ts,
        external_note_update_id=external_note_update_id,
    )


def _task_out(
    task,
    *,
    source_by_ext_id: dict[uuid.UUID, tuple[datetime, str]] | None = None,
    display_external_note_update_id: uuid.UUID | None = None,
) -> NoteTaskOut:
    ext_id = display_external_note_update_id or task.external_note_update_id
    preview: str | None = None
    created: datetime | None = None
    if ext_id and source_by_ext_id:
        meta = source_by_ext_id.get(ext_id)
        if meta:
            created, pv = meta[0], meta[1]
            preview = pv.strip() if pv and pv.strip() else None
    return NoteTaskOut(
        id=task.id,
        note_id=task.note_id,
        title=task.title,
        done=task.done,
        due_at=task.due_at,
        sort_order=task.sort_order,
        updated_ts=task.updated_ts,
        created_ts=task.created_ts,
        external_note_update_id=ext_id,
        source_update_created_ts=created,
        source_update_preview=preview,
    )


def _note_out(
    note,
    *,
    ext_by_chunk: dict[uuid.UUID, uuid.UUID] | None = None,
    source_by_ext_id: dict[uuid.UUID, tuple[datetime, str]] | None = None,
    task_display_external_id: dict[uuid.UUID, uuid.UUID] | None = None,
) -> NoteOut:
    chunks = list(note.chunks or [])
    chunks_sorted = sorted(chunks, key=lambda c: (c.sort_order, c.created_ts))
    tasks_sorted = sorted(
        list(note.tasks or []),
        key=lambda t: (t.sort_order, t.created_ts),
    )
    ext_by_chunk = ext_by_chunk or {}
    return NoteOut(
        id=note.id,
        title=note.title,
        description=note.description,
        archived=note.archived,
        full_markdown=join_chunks_markdown(chunks_sorted),
        chunks=[
            _chunk_out(
                c,
                external_note_update_id=ext_by_chunk.get(c.id),
            )
            for c in chunks_sorted
        ],
        tasks=[
            _task_out(
                t,
                source_by_ext_id=source_by_ext_id,
                display_external_note_update_id=(
                    task_display_external_id or {}
                ).get(t.id),
            )
            for t in tasks_sorted
        ],
        updated_ts=note.updated_ts,
        created_ts=note.created_ts,
    )


class NoteService(BaseService):
    def __init__(
        self,
        repository: NoteRepositoryDep,
        chunk_repository: ChunkRepositoryDep,
        timeline: NoteTimelineRepositoryDep,
        external_note_update_repository: ExternalNoteUpdateRepositoryDep,
        note_task_repository: NoteTaskRepositoryDep,
        current_user: CurrentUser,
    ) -> None:
        self.repository = repository
        self.chunk_repository = chunk_repository
        self.timeline = timeline
        self.external_note_update_repository = external_note_update_repository
        self.note_task_repository = note_task_repository
        self.current_user = current_user

    async def _task_display_external_id_by_task_id(
        self, note
    ) -> dict[uuid.UUID, uuid.UUID]:
        tasks = list(note.tasks or [])
        if not tasks:
            return {}
        out: dict[uuid.UUID, uuid.UUID] = {}
        need_keys: list[tuple[uuid.UUID, uuid.UUID]] = []
        for t in tasks:
            if t.external_note_update_id:
                out[t.id] = t.external_note_update_id
            else:
                need_keys.append((note.id, t.id))
        if need_keys:
            hist = await self.note_task_repository.earliest_external_note_update_ids_for_task_keys(
                need_keys
            )
            for (nid, tid), ext_id in hist.items():
                if nid == note.id:
                    out[tid] = ext_id
        return out

    async def _source_preview_by_ext_ids(
        self, ext_ids: set[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[datetime, str]]:
        if not ext_ids:
            return {}
        rows = await self.external_note_update_repository.read_by_ids(list(ext_ids))
        return {
            eid: (row.created_ts, _incoming_update_preview(row.body_md))
            for eid, row in rows.items()
        }

    async def _note_task_display_and_sources(
        self, note
    ) -> tuple[dict[uuid.UUID, uuid.UUID], dict[uuid.UUID, tuple[datetime, str]]]:
        display_by_task = await self._task_display_external_id_by_task_id(note)
        ext_ids = {eid for eid in display_by_task.values() if eid}
        source_by = await self._source_preview_by_ext_ids(ext_ids)
        return display_by_task, source_by

    async def get_detail(self, id: uuid.UUID) -> NoteOut:
        note = await self.repository.read_by_id(id)
        chunks = list(note.chunks or [])
        chunks_sorted = sorted(chunks, key=lambda c: (c.sort_order, c.created_ts))
        ext_by_chunk = await self.timeline.latest_external_note_update_ids_for_chunks(
            note.id,
            [c.id for c in chunks_sorted],
        )
        task_display_external_id, source_by_ext_id = (
            await self._note_task_display_and_sources(note)
        )
        return _note_out(
            note,
            ext_by_chunk=ext_by_chunk,
            source_by_ext_id=source_by_ext_id,
            task_display_external_id=task_display_external_id,
        )

    async def create(self, data: NoteCreate) -> NoteOut:
        internal = NoteCreateInternal(
            title=data.title,
            description=data.description,
            creator_id=self.current_user.id,
        )
        note = await self.repository.create(internal)
        await self.chunk_repository.create(
            ChunkCreateInternal(
                note_id=note.id,
                body_md="",
                sort_order=0,
                due_at=None,
                completed=False,
            ),
        )
        note = await self.repository.read_by_id(note.id)
        await self.timeline.record_note_snapshot(
            note_id=note.id,
            title=note.title,
            description=note.description,
            archived=note.archived,
            editor_id=self.current_user.id,
        )
        chunks = list(note.chunks or [])
        for c in sorted(chunks, key=lambda x: (x.sort_order, x.created_ts)):
            await self.timeline.record_chunk_snapshot(
                note_id=note.id,
                chunk_id=c.id,
                body_md=c.body_md,
                sort_order=c.sort_order,
                due_at=c.due_at,
                completed=c.completed,
                deleted=False,
                editor_id=self.current_user.id,
            )
        note = await self.repository.read_by_id(note.id)
        chunks_sorted = sorted(
            list(note.chunks or []),
            key=lambda x: (x.sort_order, x.created_ts),
        )
        ext_by_chunk = await self.timeline.latest_external_note_update_ids_for_chunks(
            note.id,
            [c.id for c in chunks_sorted],
        )
        task_display_external_id, source_by_ext_id = (
            await self._note_task_display_and_sources(note)
        )
        return _note_out(
            note,
            ext_by_chunk=ext_by_chunk,
            source_by_ext_id=source_by_ext_id,
            task_display_external_id=task_display_external_id,
        )

    async def list_notes(
        self,
        skip: int,
        limit: int,
        archived: bool = False,
    ) -> NotesOut:
        filters: dict[str, list[Any] | None] = {"archived": [archived]}
        rows = await self.repository.list(filters, skip, limit)
        count = await self.repository.count(filters)
        note_ids = [n.id for n in rows]
        pending_by_note = await self.note_task_repository.count_open_tasks_by_note_ids(
            note_ids
        )
        next_actions: list[NextAction] = []
        recent_done_actions: list[NextAction] = []
        if not archived:
            pairs = await self.note_task_repository.list_next_open_tasks(limit=12)
            done_pairs = await self.note_task_repository.list_recent_done_tasks(limit=24)
            merged = pairs + done_pairs
            hist_keys = [
                (n.id, t.id) for t, n in merged if not t.external_note_update_id
            ]
            hist_map = await self.note_task_repository.earliest_external_note_update_ids_for_task_keys(
                hist_keys
            )

            def _resolved_task_ext_id(task, note) -> uuid.UUID | None:
                return task.external_note_update_id or hist_map.get(
                    (note.id, task.id)
                )

            ext_ids = {
                eid
                for t, n in merged
                if (eid := _resolved_task_ext_id(t, n)) is not None
            }
            source_by_ext_id = await self._source_preview_by_ext_ids(ext_ids)
            for task, note in pairs:
                ext_id = _resolved_task_ext_id(task, note)
                meta = source_by_ext_id.get(ext_id) if ext_id else None
                next_actions.append(
                    NextAction(
                        note_id=note.id,
                        note_title=note.title,
                        task_id=task.id,
                        task_title=task.title,
                        due_at=task.due_at,
                        external_note_update_id=ext_id,
                        source_update_created_ts=meta[0] if meta else None,
                        source_update_preview=meta[1] if meta else None,
                    )
                )
            for task, note in done_pairs:
                ext_id = _resolved_task_ext_id(task, note)
                meta = source_by_ext_id.get(ext_id) if ext_id else None
                recent_done_actions.append(
                    NextAction(
                        note_id=note.id,
                        note_title=note.title,
                        task_id=task.id,
                        task_title=task.title,
                        due_at=task.due_at,
                        external_note_update_id=ext_id,
                        source_update_created_ts=meta[0] if meta else None,
                        source_update_preview=meta[1] if meta else None,
                        done_updated_ts=task.updated_ts,
                    )
                )
        return NotesOut(
            data=[
                Notes(
                    id=n.id,
                    title=n.title,
                    description=n.description,
                    archived=n.archived,
                    updated_ts=n.updated_ts,
                    created_ts=n.created_ts,
                    pending_task_count=pending_by_note.get(n.id, 0),
                )
                for n in rows
            ],
            count=count or 0,
            next_actions=next_actions,
            recent_done_actions=recent_done_actions,
        )

    async def update_note(self, id: uuid.UUID, data: NoteUpdate) -> NoteOut:
        note = await self.repository.update(id, data)
        await self.timeline.record_note_snapshot(
            note_id=note.id,
            title=note.title,
            description=note.description,
            archived=note.archived,
            editor_id=self.current_user.id,
        )
        chunks = list(note.chunks or [])
        chunks_sorted = sorted(chunks, key=lambda c: (c.sort_order, c.created_ts))
        ext_by_chunk = await self.timeline.latest_external_note_update_ids_for_chunks(
            note.id,
            [c.id for c in chunks_sorted],
        )
        task_display_external_id, source_by_ext_id = (
            await self._note_task_display_and_sources(note)
        )
        return _note_out(
            note,
            ext_by_chunk=ext_by_chunk,
            source_by_ext_id=source_by_ext_id,
            task_display_external_id=task_display_external_id,
        )

    async def get_timeline(
        self,
        note_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> NoteTimelineOut:
        raw, total, eff_skip, eff_limit = await self.timeline.list_timeline(
            note_id, skip=skip, limit=limit
        )
        events: list[NoteHistoryEvent | ChunkHistoryEvent | TaskHistoryEvent] = []
        for e in raw:
            if e["kind"] == "note":
                events.append(
                    NoteHistoryEvent(
                        id=e["id"],
                        changed_ts=e["changed_ts"],
                        title=e["title"],
                        description=e["description"],
                        archived=e["archived"],
                        external_note_update_id=e["external_note_update_id"],
                    )
                )
            elif e["kind"] == "task":
                events.append(
                    TaskHistoryEvent(
                        id=e["id"],
                        task_id=e["task_id"],
                        changed_ts=e["changed_ts"],
                        title=e["title"],
                        done=e["done"],
                        due_at=e["due_at"],
                        sort_order=e["sort_order"],
                        deleted=e["deleted"],
                        external_note_update_id=e["external_note_update_id"],
                    )
                )
            else:
                events.append(
                    ChunkHistoryEvent(
                        id=e["id"],
                        chunk_id=e["chunk_id"],
                        changed_ts=e["changed_ts"],
                        body_md=e["body_md"],
                        sort_order=e["sort_order"],
                        due_at=e["due_at"],
                        completed=e["completed"],
                        deleted=e["deleted"],
                        external_note_update_id=e["external_note_update_id"],
                    )
                )
        return NoteTimelineOut(
            events=events,
            total=total,
            skip=eff_skip,
            limit=eff_limit,
        )

    async def get_chunk_timeline(
        self,
        note_id: uuid.UUID,
        chunk_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> ChunkTimelineOut:
        raw, total, eff_skip, eff_limit = await self.timeline.list_chunk_timeline(
            note_id, chunk_id, skip=skip, limit=limit
        )
        events = [
            ChunkHistoryEvent(
                id=e["id"],
                chunk_id=e["chunk_id"],
                changed_ts=e["changed_ts"],
                body_md=e["body_md"],
                sort_order=e["sort_order"],
                due_at=e["due_at"],
                completed=e["completed"],
                deleted=e["deleted"],
                external_note_update_id=e["external_note_update_id"],
            )
            for e in raw
        ]
        return ChunkTimelineOut(
            events=events,
            total=total,
            skip=eff_skip,
            limit=eff_limit,
        )

    async def patch_note_task(
        self,
        note_id: uuid.UUID,
        task_id: uuid.UUID,
        data: NoteTaskPatch,
    ) -> NoteOut:
        await self.repository.read_by_id(note_id)
        task = await self.note_task_repository.update_for_note(
            note_id, task_id, data
        )
        await self.timeline.record_task_snapshot(
            note_id=note_id,
            task_id=task.id,
            title=task.title,
            done=task.done,
            due_at=task.due_at,
            sort_order=task.sort_order,
            deleted=False,
            editor_id=self.current_user.id,
            external_note_update_id=None,
        )
        note = await self.repository.read_by_id(note_id)
        chunks_sorted = sorted(
            list(note.chunks or []),
            key=lambda c: (c.sort_order, c.created_ts),
        )
        ext_by_chunk = await self.timeline.latest_external_note_update_ids_for_chunks(
            note.id,
            [c.id for c in chunks_sorted],
        )
        task_display_external_id, source_by_ext_id = (
            await self._note_task_display_and_sources(note)
        )
        return _note_out(
            note,
            ext_by_chunk=ext_by_chunk,
            source_by_ext_id=source_by_ext_id,
            task_display_external_id=task_display_external_id,
        )

    async def list_incoming_updates(
        self,
        note_id: uuid.UUID,
        *,
        chunk_id: uuid.UUID | None = None,
    ) -> ExternalNoteUpdatesOut:
        note = await self.repository.read_by_id(note_id)
        rows = await self.external_note_update_repository.list_by_matched_note_id(
            note_id
        )
        if chunk_id is not None:
            chunk_ids = {c.id for c in (note.chunks or [])}
            if chunk_id not in chunk_ids:
                raise HTTPException(status_code=404, detail="Section not found")
            allowed = await self.timeline.distinct_external_note_update_ids_for_chunk(
                note_id, chunk_id
            )
            rows = [r for r in rows if r.id in allowed]
        return ExternalNoteUpdatesOut(
            data=[
                _external_note_update_out(r, matched_note_title=note.title)
                for r in rows
            ],
        )

    async def get_incoming_update_for_note(
        self, note_id: uuid.UUID, update_id: uuid.UUID
    ) -> ExternalNoteUpdateOut:
        note = await self.repository.read_by_id(note_id)
        row = await self.external_note_update_repository.read_for_matched_note(
            note_id, update_id
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Incoming update not found")
        return _external_note_update_out(row, matched_note_title=note.title)

    async def list_my_external_note_updates(
        self, skip: int = 0, limit: int = 100
    ) -> ExternalNoteUpdatesPageOut:
        rows, total = await self.external_note_update_repository.list_for_creator(
            skip=skip, limit=limit
        )
        note_ids = list({nid for r in rows if (nid := r.matched_note_id)})
        titles = await self.repository.read_titles_by_ids(note_ids)
        return ExternalNoteUpdatesPageOut(
            data=[
                _external_note_update_out(
                    r,
                    matched_note_title=titles.get(r.matched_note_id)
                    if r.matched_note_id
                    else None,
                )
                for r in rows
            ],
            count=total,
        )

    async def delete_note(self, id: uuid.UUID) -> None:
        await self.repository.delete(id)

    async def undo_merged_external_note_update(
        self, update_id: uuid.UUID
    ) -> ExternalNoteUpdateOut:
        ext_row = await self.external_note_update_repository.read_by_id(update_id)
        if ext_row.status != "merged" or ext_row.matched_note_id is None:
            raise HTTPException(
                status_code=400,
                detail="Only completed merges can be undone.",
            )
        note_id = ext_row.matched_note_id
        note = await self.repository.read_by_id(note_id)
        session = self.chunk_repository.session
        ch_hist, n_hist, t_hist, merge_chunk_ids = await verify_merge_undoable(
            session,
            note_id=note_id,
            ext_id=update_id,
            note=note,
        )
        merge_task_ids = {
            h.task_id for h in t_hist if h.external_note_update_id == update_id
        }
        editor_id = self.current_user.id

        for chunk_id in merge_chunk_ids:
            prior, outcome = chunk_merge_boundaries(ch_hist, chunk_id, update_id)
            if prior is None and outcome is not None and not outcome.deleted:
                try:
                    ch = await self.chunk_repository.read_by_id(chunk_id)
                except HTTPException:
                    continue
                await self.timeline.record_chunk_snapshot(
                    note_id=note_id,
                    chunk_id=ch.id,
                    body_md=ch.body_md,
                    sort_order=ch.sort_order,
                    due_at=ch.due_at,
                    completed=ch.completed,
                    deleted=True,
                    editor_id=editor_id,
                    external_note_update_id=None,
                )
                await self.chunk_repository.delete(chunk_id)

        for chunk_id in merge_chunk_ids:
            prior, outcome = chunk_merge_boundaries(ch_hist, chunk_id, update_id)
            if (
                prior is not None
                and not prior.deleted
                and outcome is not None
                and outcome.deleted
            ):
                existing = await session.get(Chunk, chunk_id)
                if existing is None:
                    restored = Chunk(
                        id=chunk_id,
                        note_id=note_id,
                        body_md=prior.body_md,
                        sort_order=prior.sort_order,
                        due_at=prior.due_at,
                        completed=prior.completed,
                        created_ts=datetime.now(timezone.utc),
                        updated_ts=datetime.now(timezone.utc),
                    )
                    session.add(restored)
                    await session.commit()
                    await self.timeline.record_chunk_snapshot(
                        note_id=note_id,
                        chunk_id=chunk_id,
                        body_md=prior.body_md,
                        sort_order=prior.sort_order,
                        due_at=prior.due_at,
                        completed=prior.completed,
                        deleted=False,
                        editor_id=editor_id,
                        external_note_update_id=None,
                    )

        for chunk_id in merge_chunk_ids:
            prior, outcome = chunk_merge_boundaries(ch_hist, chunk_id, update_id)
            if (
                prior is not None
                and not prior.deleted
                and outcome is not None
                and not outcome.deleted
            ):
                existing = await session.get(Chunk, chunk_id)
                if existing is not None:
                    await self.chunk_repository.update(
                        chunk_id,
                        ChunkUpdate(
                            body_md=prior.body_md,
                            sort_order=prior.sort_order,
                            due_at=prior.due_at,
                            completed=prior.completed,
                        ),
                    )
                    await self.timeline.record_chunk_snapshot(
                        note_id=note_id,
                        chunk_id=chunk_id,
                        body_md=prior.body_md,
                        sort_order=prior.sort_order,
                        due_at=prior.due_at,
                        completed=prior.completed,
                        deleted=False,
                        editor_id=editor_id,
                        external_note_update_id=None,
                    )

        for task_id in merge_task_ids:
            prior, outcome = task_merge_boundaries(t_hist, task_id, update_id)
            if prior is None and outcome is not None and not outcome.deleted:
                row = await session.get(NoteTask, task_id)
                if row is None or row.note_id != note_id:
                    continue
                await self.timeline.record_task_snapshot(
                    note_id=note_id,
                    task_id=row.id,
                    title=row.title,
                    done=row.done,
                    due_at=row.due_at,
                    sort_order=row.sort_order,
                    deleted=True,
                    editor_id=editor_id,
                    external_note_update_id=None,
                )
                await self.note_task_repository.delete(task_id)

        for task_id in merge_task_ids:
            prior, outcome = task_merge_boundaries(t_hist, task_id, update_id)
            if (
                prior is not None
                and not prior.deleted
                and outcome is not None
                and outcome.deleted
            ):
                existing = await session.get(NoteTask, task_id)
                if existing is None:
                    restored = NoteTask(
                        id=task_id,
                        note_id=note_id,
                        title=prior.title,
                        done=prior.done,
                        due_at=prior.due_at,
                        sort_order=prior.sort_order,
                        external_note_update_id=None,
                        created_ts=datetime.now(timezone.utc),
                        updated_ts=datetime.now(timezone.utc),
                    )
                    session.add(restored)
                    await session.commit()
                    await self.timeline.record_task_snapshot(
                        note_id=note_id,
                        task_id=task_id,
                        title=prior.title,
                        done=prior.done,
                        due_at=prior.due_at,
                        sort_order=prior.sort_order,
                        deleted=False,
                        editor_id=editor_id,
                        external_note_update_id=None,
                    )

        for task_id in merge_task_ids:
            prior, outcome = task_merge_boundaries(t_hist, task_id, update_id)
            if (
                prior is not None
                and not prior.deleted
                and outcome is not None
                and not outcome.deleted
            ):
                row = await session.get(NoteTask, task_id)
                if row is None or row.note_id != note_id:
                    continue
                row.title = prior.title
                row.done = prior.done
                row.due_at = prior.due_at
                row.sort_order = prior.sort_order
                if row.external_note_update_id == update_id:
                    row.external_note_update_id = None
                row.updated_ts = datetime.now(timezone.utc)
                session.add(row)
                await session.commit()
                await self.timeline.record_task_snapshot(
                    note_id=note_id,
                    task_id=row.id,
                    title=row.title,
                    done=row.done,
                    due_at=row.due_at,
                    sort_order=row.sort_order,
                    deleted=False,
                    editor_id=editor_id,
                    external_note_update_id=None,
                )

        n_prior, n_out = note_merge_boundaries(n_hist, update_id)
        if n_out is not None and n_prior is not None:
            await self.repository.update(
                note_id,
                NoteUpdate(
                    title=n_prior.title,
                    description=n_prior.description,
                    archived=n_prior.archived,
                ),
            )
            note_after = await self.repository.read_by_id(note_id)
            await self.timeline.record_note_snapshot(
                note_id=note_id,
                title=note_after.title,
                description=note_after.description,
                archived=note_after.archived,
                editor_id=editor_id,
                external_note_update_id=None,
            )

        await self.external_note_update_repository.update(
            update_id,
            ExternalNoteUpdatePatch(status="undone"),
        )
        refreshed = await self.external_note_update_repository.read_by_id(update_id)
        titles = await self.repository.read_titles_by_ids(
            [nid] if (nid := refreshed.matched_note_id) else []
        )
        return _external_note_update_out(
            refreshed,
            matched_note_title=titles.get(refreshed.matched_note_id)
            if refreshed.matched_note_id
            else None,
        )

    async def _queue_external_update_merge_rerun(
        self, update_id: uuid.UUID, target_note_id: uuid.UUID
    ) -> None:
        """Set matched note and status=pending (after merged→undone, awaiting_note, or undone)."""
        tgt = await self.repository.read_by_id(target_note_id)
        if tgt.archived:
            raise HTTPException(
                status_code=400,
                detail="Cannot reapply into an archived note.",
            )
        await self.external_note_update_repository.update(
            update_id,
            ExternalNoteUpdatePatch(
                matched_note_id=target_note_id,
                status="pending",
                error_message=None,
            ),
        )

    async def prepare_sent_update_merge_rerun(
        self, update_id: uuid.UUID, target_note_id: uuid.UUID
    ) -> None:
        ext_row = await self.external_note_update_repository.read_by_id(update_id)
        if ext_row.status == "merged":
            await self.undo_merged_external_note_update(update_id)
        elif ext_row.status == "awaiting_note":
            pass
        elif ext_row.status != "undone":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only a merged update (to undo first), an update waiting for a "
                    "note choice, or an undone update can be queued to merge into a note."
                ),
            )
        await self._queue_external_update_merge_rerun(update_id, target_note_id)


class ChunkService(BaseService):
    def __init__(
        self,
        repository: ChunkRepositoryDep,
        timeline: NoteTimelineRepositoryDep,
        current_user: CurrentUser,
        note_repository: NoteRepositoryDep,
    ) -> None:
        self.repository = repository
        self.timeline = timeline
        self.current_user = current_user
        self.note_repository = note_repository

    async def create_chunk(self, note_id: uuid.UUID, data: ChunkCreate) -> ChunkOut:
        await self.note_repository.read_by_id(note_id)
        sort_order = data.sort_order
        if sort_order is None:
            sort_order = await self.repository.next_sort_order(note_id)
        completed = data.completed if data.completed is not None else False
        internal = ChunkCreateInternal(
            note_id=note_id,
            body_md=data.body_md,
            sort_order=sort_order,
            due_at=data.due_at,
            completed=completed,
        )
        chunk = await self.repository.create(internal)
        await self.timeline.record_chunk_snapshot(
            note_id=chunk.note_id,
            chunk_id=chunk.id,
            body_md=chunk.body_md,
            sort_order=chunk.sort_order,
            due_at=chunk.due_at,
            completed=chunk.completed,
            deleted=False,
            editor_id=self.current_user.id,
        )
        ext_by_chunk = await self.timeline.latest_external_note_update_ids_for_chunks(
            chunk.note_id,
            [chunk.id],
        )
        return _chunk_out(
            chunk,
            external_note_update_id=ext_by_chunk.get(chunk.id),
        )

    async def update_chunk(self, id: uuid.UUID, data: ChunkUpdate) -> ChunkOut:
        chunk = await self.repository.update(id, data)
        await self.timeline.record_chunk_snapshot(
            note_id=chunk.note_id,
            chunk_id=chunk.id,
            body_md=chunk.body_md,
            sort_order=chunk.sort_order,
            due_at=chunk.due_at,
            completed=chunk.completed,
            deleted=False,
            editor_id=self.current_user.id,
        )
        ext_by_chunk = await self.timeline.latest_external_note_update_ids_for_chunks(
            chunk.note_id,
            [chunk.id],
        )
        return _chunk_out(
            chunk,
            external_note_update_id=ext_by_chunk.get(chunk.id),
        )

    async def delete_chunk(self, id: uuid.UUID) -> None:
        chunk = await self.repository.read_by_id(id)
        await self.timeline.record_chunk_snapshot(
            note_id=chunk.note_id,
            chunk_id=chunk.id,
            body_md=chunk.body_md,
            sort_order=chunk.sort_order,
            due_at=chunk.due_at,
            completed=chunk.completed,
            deleted=True,
            editor_id=self.current_user.id,
        )
        await self.repository.delete(id)


NoteServiceDep = Annotated[NoteService, Depends(NoteService)]
ChunkServiceDep = Annotated[ChunkService, Depends(ChunkService)]
