"""Restore note state before a merge using append-only history (strict consistency)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import asc, select

from .models import Chunk, ChunkHistory, Note, NoteHistory, NoteTask, NoteTaskHistory


async def _chunk_histories_for_note(session, note_id: uuid.UUID) -> list[ChunkHistory]:
    stmt = (
        select(ChunkHistory)
        .where(ChunkHistory.note_id == note_id)
        .order_by(asc(ChunkHistory.changed_ts), asc(ChunkHistory.id))
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _note_histories_for_note(session, note_id: uuid.UUID) -> list[NoteHistory]:
    stmt = (
        select(NoteHistory)
        .where(NoteHistory.note_id == note_id)
        .order_by(asc(NoteHistory.changed_ts), asc(NoteHistory.id))
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _task_histories_for_note(session, note_id: uuid.UUID) -> list[NoteTaskHistory]:
    stmt = (
        select(NoteTaskHistory)
        .where(NoteTaskHistory.note_id == note_id)
        .order_by(asc(NoteTaskHistory.changed_ts), asc(NoteTaskHistory.id))
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


def chunk_merge_boundaries(
    hist: list[ChunkHistory], chunk_id: uuid.UUID, ext_id: uuid.UUID
) -> tuple[ChunkHistory | None, ChunkHistory | None]:
    """Return (state before first merge row, last merge row) for this chunk and ext id."""
    rows = [h for h in hist if h.chunk_id == chunk_id]
    i_first: int | None = None
    for i, h in enumerate(rows):
        if h.external_note_update_id == ext_id:
            i_first = i
            break
    if i_first is None:
        return None, None
    prior = rows[i_first - 1] if i_first > 0 else None
    outcome = rows[i_first]
    for h in rows[i_first + 1 :]:
        if h.external_note_update_id == ext_id:
            outcome = h
    return prior, outcome


def task_merge_boundaries(
    hist: list[NoteTaskHistory], task_id: uuid.UUID, ext_id: uuid.UUID
) -> tuple[NoteTaskHistory | None, NoteTaskHistory | None]:
    rows = [h for h in hist if h.task_id == task_id]
    i_first: int | None = None
    for i, h in enumerate(rows):
        if h.external_note_update_id == ext_id:
            i_first = i
            break
    if i_first is None:
        return None, None
    prior = rows[i_first - 1] if i_first > 0 else None
    outcome = rows[i_first]
    for h in rows[i_first + 1 :]:
        if h.external_note_update_id == ext_id:
            outcome = h
    return prior, outcome


def note_merge_boundaries(
    hist: list[NoteHistory], ext_id: uuid.UUID
) -> tuple[NoteHistory | None, NoteHistory | None]:
    i_first: int | None = None
    for i, h in enumerate(hist):
        if h.external_note_update_id == ext_id:
            i_first = i
            break
    if i_first is None:
        return None, None
    prior = hist[i_first - 1] if i_first > 0 else None
    outcome = hist[i_first]
    for h in hist[i_first + 1 :]:
        if h.external_note_update_id == ext_id:
            outcome = h
    return prior, outcome


def _dt_equal(a: datetime | None, b: datetime | None) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return a.replace(tzinfo=a.tzinfo or timezone.utc) == b.replace(
        tzinfo=b.tzinfo or timezone.utc
    )


def _chunk_matches_outcome(chunk: Chunk | None, outcome: ChunkHistory) -> bool:
    if outcome.deleted:
        return chunk is None
    if chunk is None:
        return False
    return (
        (chunk.body_md or "") == (outcome.body_md or "")
        and int(chunk.sort_order) == int(outcome.sort_order)
        and _dt_equal(chunk.due_at, outcome.due_at)
        and bool(chunk.completed) == bool(outcome.completed)
    )


def _task_matches_outcome(task: NoteTask | None, outcome: NoteTaskHistory) -> bool:
    if outcome.deleted:
        return task is None
    if task is None:
        return False
    return (
        (task.title or "") == (outcome.title or "")
        and bool(task.done) == bool(outcome.done)
        and int(task.sort_order) == int(outcome.sort_order)
        and _dt_equal(task.due_at, outcome.due_at)
    )


def _note_matches_outcome(note: Note, outcome: NoteHistory) -> bool:
    return (
        (note.title or "") == (outcome.title or "")
        and (note.description or "") == (outcome.description or "")
        and bool(note.archived) == bool(outcome.archived)
    )


async def verify_merge_undoable(
    session,
    *,
    note_id: uuid.UUID,
    ext_id: uuid.UUID,
    note: Note,
) -> tuple[list[ChunkHistory], list[NoteHistory], list[NoteTaskHistory], set[uuid.UUID]]:
    ch_hist = await _chunk_histories_for_note(session, note_id)
    n_hist = await _note_histories_for_note(session, note_id)
    t_hist = await _task_histories_for_note(session, note_id)

    merge_chunk_ids = {
        h.chunk_id for h in ch_hist if h.external_note_update_id == ext_id
    }
    if not merge_chunk_ids and not any(
        h.external_note_update_id == ext_id for h in n_hist
    ) and not any(h.external_note_update_id == ext_id for h in t_hist):
        raise HTTPException(
            status_code=400,
            detail="No merge history found for this update; cannot undo.",
        )

    for chunk_id in merge_chunk_ids:
        _, outcome = chunk_merge_boundaries(ch_hist, chunk_id, ext_id)
        if outcome is None:
            continue
        chunk = await session.get(Chunk, chunk_id)
        if chunk is not None and chunk.note_id != note_id:
            chunk = None
        if not _chunk_matches_outcome(chunk, outcome):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This merge can no longer be undone because the note was "
                    "edited after the merge. Undo only works while the merged "
                    "content is unchanged."
                ),
            )

    merge_task_ids = {h.task_id for h in t_hist if h.external_note_update_id == ext_id}
    for task_id in merge_task_ids:
        _, outcome = task_merge_boundaries(t_hist, task_id, ext_id)
        if outcome is None:
            continue
        task = await session.get(NoteTask, task_id)
        if task is not None and task.note_id != note_id:
            task = None
        if not _task_matches_outcome(task, outcome):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This merge can no longer be undone because follow-ups were "
                    "changed after the merge."
                ),
            )

    _, n_out = note_merge_boundaries(n_hist, ext_id)
    if n_out is not None and not _note_matches_outcome(note, n_out):
        raise HTTPException(
            status_code=409,
            detail=(
                "This merge can no longer be undone because the note title, "
                "description, or archive state was edited after the merge."
            ),
        )

    return ch_hist, n_hist, t_hist, merge_chunk_ids
