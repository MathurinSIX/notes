import json
import logging
import time
import uuid
from typing import Annotated

from fastapi import Depends
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, SecretStr
from sqlmodel import select

from app.api.deps import async_session
from app.api.routes.note.models import ExternalNoteUpdate, Note
from app.api.routes.note.repository import (
    ChunkRepository,
    ExternalNoteUpdateRepository,
    NoteRepository,
    NoteTaskRepository,
    NoteTimelineRepository,
)
from app.api.routes.note.schemas import (
    ChunkCreateInternal,
    ChunkUpdate,
    ExternalNoteUpdatePatch,
    NoteTaskMergeItem,
    NoteUpdate,
)
from app.api.routes.run.repository import RunRepository
from app.api.routes.run_step.repository import RunStepRepository
from app.api.routes.user.models import User
from app.core.config import settings
from app.workflows.utils.loggers import Loggers, WaitForInput
from app.workflows.utils.metrics import set_token_usage


class UpdateNotesWorkflowInput(BaseModel):
    body_md: str = Field(min_length=1, max_length=200_000)
    fallback_note_id: uuid.UUID | None = Field(
        default=None,
        description=(
            "When set and the match step returns no/invalid note id, merge into "
            "this note if it belongs to the user and is not archived."
        ),
    )


class UpdateNotesWorkflowRunParams(BaseModel):
    external_note_update_id: uuid.UUID
    fallback_note_id: uuid.UUID | None = None


class NoteMatchResult(BaseModel):
    matched_note_id: uuid.UUID | None = Field(
        default=None,
        description="UUID of the best-matching note for the user",
    )


class PlannedChunk(BaseModel):
    existing_chunk_id: uuid.UUID | None = Field(
        default=None,
        description="Existing chunk UUID to keep and update, or null for a new section",
    )
    body_md: str = Field(description="Markdown body for this section after merge")
    sort_order: int = Field(ge=0, description="Order of this section in the note")


class NoteMergePlan(BaseModel):
    chunks: list[PlannedChunk] = Field(
        description="Full list of sections after merging the update into the note"
    )
    note_summary: str | None = Field(
        default=None,
        description="Concise summary of the note after the merge (1–3 sentences)",
    )
    modify_tasks: bool = Field(
        default=False,
        description=(
            "If true, replace the note's follow-up tasks using `tasks` "
            "(empty list clears all tasks). If false, leave tasks unchanged."
        ),
    )
    tasks: list[NoteTaskMergeItem] = Field(
        default_factory=list,
        description=(
            "When modify_tasks is true: full task list with stable ids for "
            "existing rows (existing_task_id) and null for new rows."
        ),
    )


def _llm() -> ChatOpenAI:
    if settings.OPENAI_API_KEY is None:
        raise ValueError(
            "OPENAI_API_KEY is required for this workflow. "
            "Set OPENAI_API_KEY in your environment."
        )
    return ChatOpenAI(
        api_key=SecretStr(settings.OPENAI_API_KEY),
        model="gpt-5",
    )


class UpdateNotesWorkflowTask:
    async def run(self, data: UpdateNotesWorkflowRunParams) -> None:
        async with async_session() as session:
            ext_row = await session.get(ExternalNoteUpdate, data.external_note_update_id)
            if not ext_row:
                logging.error(
                    "update-notes: ExternalNoteUpdate %s not found",
                    data.external_note_update_id,
                )
                return
            user = await session.get(User, ext_row.creator_id)
            if not user:
                logging.error("update-notes: creator user missing for update %s", ext_row.id)
                return

            run_repo = RunRepository(session, user)
            step_repo = RunStepRepository(session, user)
            loggers = Loggers(run_repo, step_repo, session, user)

            total_steps = 4
            async with loggers.logger_run(
                workflow="update-notes",
                data={
                    "external_note_update_id": str(data.external_note_update_id),
                    "name": "Update notes",
                },
                total_steps=total_steps,
            ) as run_context:
                note_repo = NoteRepository(session, user)
                chunk_repo = ChunkRepository(session, user)
                timeline = NoteTimelineRepository(session, user)
                ext_repo = ExternalNoteUpdateRepository(session, user)

                try:
                    async with loggers.logger_step(
                        name="Load update and notes",
                        description="Load update and notes",
                    ):
                        stmt = (
                            select(Note)
                            .where(
                                Note.creator_id == user.id,
                                Note.archived.is_(False),
                            )
                            .order_by(Note.updated_ts.desc())
                        )
                        notes = list((await session.execute(stmt)).scalars().all())

                    if not notes:
                        await ext_repo.update(
                            ext_row.id,
                            ExternalNoteUpdatePatch(status="no_match"),
                        )
                        run_context.output = {
                            "status": "no_match",
                            "reason": "no_active_notes",
                        }
                        return

                    note_cards = [
                        {
                            "id": str(n.id),
                            "title": n.title or "",
                            "summary": (n.summary or "").strip(),
                        }
                        for n in notes
                    ]
                    update_text = ext_row.body_md.strip()

                    async with loggers.logger_step(
                        name="Match note (OpenAI)",
                        description="Pick best note using summaries",
                        wait_for=WaitForInput(
                            exp="UpdateNotesMatch%",
                            max_simultaneous_steps=2,
                        ),
                    ) as metrics:
                        model = _llm()
                        structured = model.with_structured_output(
                            NoteMatchResult, include_raw=True
                        )
                        prompt = f"""You help route incoming text to the user's existing note that it belongs with.

Incoming update (raw text from the user):
---
{update_text}
---

Candidate notes (use id, title, and summary only):
{json.dumps(note_cards, indent=2)}

Return matched_note_id for the single best-fitting note. If several could work, pick the closest by topic; if still ambiguous, prefer the note whose id appears first in the candidate list (most recently updated)."""
                        start = time.time()
                        result = await structured.ainvoke(prompt)
                        parsed = result.get("parsed")
                        if not isinstance(parsed, NoteMatchResult):
                            raise ValueError("OpenAI match step returned no structured result")
                        raw = result["raw"]
                        if raw and getattr(raw, "response_metadata", None):
                            tu = raw.response_metadata.get("token_usage")
                            if tu:
                                set_token_usage(token_usage=tu, metrics=metrics)
                        logging.info(
                            "update-notes: match done in %.2fs, note=%s",
                            time.time() - start,
                            parsed.matched_note_id,
                        )

                    matched_id = parsed.matched_note_id
                    valid_ids = {n["id"] for n in note_cards}
                    if matched_id is None or str(matched_id) not in valid_ids:
                        fb = data.fallback_note_id
                        if fb is not None and str(fb) in valid_ids:
                            matched_uuid = fb
                            logging.info(
                                "update-notes: no/invalid LLM match; using client fallback note %s",
                                matched_uuid,
                            )
                        else:
                            # Candidates are ordered by updated_ts desc; never end as no_match.
                            matched_uuid = notes[0].id
                            logging.info(
                                "update-notes: no/invalid LLM match; using latest modified note %s",
                                matched_uuid,
                            )
                    else:
                        matched_uuid = matched_id
                    await ext_repo.update(
                        ext_row.id,
                        ExternalNoteUpdatePatch(
                            matched_note_id=matched_uuid,
                        ),
                    )

                    note = await note_repo.read_by_id(matched_uuid)
                    chunks_sorted = sorted(
                        list(note.chunks or []),
                        key=lambda c: (c.sort_order, c.created_ts),
                    )
                    chunk_payload = [
                        {
                            "id": str(c.id),
                            "body_md": c.body_md,
                            "sort_order": c.sort_order,
                            "due_at": c.due_at.isoformat() if c.due_at else None,
                            "completed": c.completed,
                        }
                        for c in chunks_sorted
                    ]
                    tasks_sorted = sorted(
                        list(note.tasks or []),
                        key=lambda t: (t.sort_order, t.created_ts),
                    )
                    task_payload = [
                        {
                            "id": str(t.id),
                            "title": t.title,
                            "done": t.done,
                            "sort_order": t.sort_order,
                            "due_at": t.due_at.isoformat() if t.due_at else None,
                        }
                        for t in tasks_sorted
                    ]

                    async with loggers.logger_step(
                        name="Merge update (OpenAI)",
                        description="Plan merged sections",
                        wait_for=WaitForInput(
                            exp="UpdateNotesMerge%",
                            max_simultaneous_steps=2,
                        ),
                    ) as metrics2:
                        model2 = _llm()
                        structured2 = model2.with_structured_output(
                            NoteMergePlan, include_raw=True
                        )
                        merge_prompt = f"""You merge an incoming update into an existing note made of ordered markdown sections (chunks).

Incoming update:
---
{update_text}
---

Current note title: {note.title or ""}
Current note summary: {(note.summary or "").strip()}

Current sections (each has stable id — reuse ids for sections you keep or edit; use null id only for brand-new sections):
{json.dumps(chunk_payload, indent=2)}

Current follow-up tasks (each has stable id — reuse when the user completes or edits tasks; null id only for brand-new tasks):
{json.dumps(task_payload, indent=2)}

Rules:
- Return the full final list of sections in `chunks`, sorted by `sort_order` ascending.
- For any section you keep from the current note (possibly edited), set `existing_chunk_id` to that section's id.
- For brand-new sections, set `existing_chunk_id` to null.
- Remove sections by omitting their ids entirely.
- Preserve meaning; integrate the update text into the note naturally (edit, split, or add sections as needed).
- Follow-ups vs sections: `tasks` and markdown sections are independent. If you add something as a follow-up task, you do not need to repeat it as a new or edited section—only put it in `chunks` when the incoming text is substantive note body (explanations, context, lists meant to live in the note), not merely because it also appears in `tasks`.
- Set `note_summary` to a fresh short summary of the note after the merge (or null to leave summary unchanged).
- Tasks: set `modify_tasks` to true only when the incoming update adds, removes, completes, or reorders follow-ups, or when a short message is clearly about checking tasks off (then return the same tasks with updated `done` and matching `id`). Otherwise set `modify_tasks` to false and ignore `tasks`.
- When `modify_tasks` is true, `tasks` must list every task that should exist afterward (empty list clears all). Each item uses `existing_task_id` for tasks you keep from the current list, or null for new tasks. Set `done` true/false per row. Use concise `title` text.
- Optional `due_at` per task: ISO 8601 datetime when the update implies a deadline, or null for none. Preserve existing `due_at` for tasks you keep unless the update changes it."""
                        start2 = time.time()
                        merge_result = await structured2.ainvoke(merge_prompt)
                        plan = merge_result.get("parsed")
                        if not isinstance(plan, NoteMergePlan):
                            raise ValueError("OpenAI merge step returned no structured result")
                        raw2 = merge_result["raw"]
                        if raw2 and getattr(raw2, "response_metadata", None):
                            tu2 = raw2.response_metadata.get("token_usage")
                            if tu2:
                                set_token_usage(token_usage=tu2, metrics=metrics2)
                        logging.info(
                            "update-notes: merge plan in %.2fs, %d chunks",
                            time.time() - start2,
                            len(plan.chunks),
                        )

                    async with loggers.logger_step(
                        name="Apply merge to database",
                        description="Apply merge to database",
                    ):
                        existing_ids = {str(c.id) for c in chunks_sorted}
                        normalized: list[PlannedChunk] = []
                        for p in plan.chunks:
                            if p.existing_chunk_id and str(p.existing_chunk_id) not in existing_ids:
                                normalized.append(
                                    PlannedChunk(
                                        existing_chunk_id=None,
                                        body_md=p.body_md,
                                        sort_order=p.sort_order,
                                    )
                                )
                            else:
                                normalized.append(p)

                        if not normalized:
                            raise ValueError("Merge plan produced no sections")

                        used_ids = {
                            str(p.existing_chunk_id)
                            for p in normalized
                            if p.existing_chunk_id
                        }
                        for ch in chunks_sorted:
                            if str(ch.id) not in used_ids:
                                await timeline.record_chunk_snapshot(
                                    note_id=ch.note_id,
                                    chunk_id=ch.id,
                                    body_md=ch.body_md,
                                    sort_order=ch.sort_order,
                                    due_at=ch.due_at,
                                    completed=ch.completed,
                                    deleted=True,
                                    editor_id=user.id,
                                    external_note_update_id=ext_row.id,
                                )
                                await chunk_repo.delete(ch.id)

                        note = await note_repo.read_by_id(matched_uuid)
                        chunks_after_delete = sorted(
                            list(note.chunks or []),
                            key=lambda c: (c.sort_order, c.created_ts),
                        )
                        by_id = {str(c.id): c for c in chunks_after_delete}

                        for p in sorted(normalized, key=lambda x: x.sort_order):
                            if p.existing_chunk_id and str(p.existing_chunk_id) in by_id:
                                cur = by_id[str(p.existing_chunk_id)]
                                await chunk_repo.update(
                                    cur.id,
                                    ChunkUpdate(
                                        body_md=p.body_md,
                                        sort_order=p.sort_order,
                                    ),
                                )
                                updated = await chunk_repo.read_by_id(cur.id)
                                await timeline.record_chunk_snapshot(
                                    note_id=updated.note_id,
                                    chunk_id=updated.id,
                                    body_md=updated.body_md,
                                    sort_order=updated.sort_order,
                                    due_at=updated.due_at,
                                    completed=updated.completed,
                                    deleted=False,
                                    editor_id=user.id,
                                    external_note_update_id=ext_row.id,
                                )
                            else:
                                created = await chunk_repo.create(
                                    ChunkCreateInternal(
                                        note_id=matched_uuid,
                                        body_md=p.body_md,
                                        sort_order=p.sort_order,
                                        due_at=None,
                                        completed=False,
                                    ),
                                )
                                await timeline.record_chunk_snapshot(
                                    note_id=created.note_id,
                                    chunk_id=created.id,
                                    body_md=created.body_md,
                                    sort_order=created.sort_order,
                                    due_at=created.due_at,
                                    completed=created.completed,
                                    deleted=False,
                                    editor_id=user.id,
                                    external_note_update_id=ext_row.id,
                                )

                        if plan.note_summary is not None:
                            await note_repo.update(
                                matched_uuid,
                                NoteUpdate(summary=plan.note_summary.strip() or None),
                            )
                            note_after = await note_repo.read_by_id(matched_uuid)
                            await timeline.record_note_snapshot(
                                note_id=matched_uuid,
                                title=note_after.title,
                                summary=note_after.summary,
                                archived=note_after.archived,
                                editor_id=user.id,
                                external_note_update_id=ext_row.id,
                            )

                        if plan.modify_tasks:
                            task_repo = NoteTaskRepository(session, user)
                            await task_repo.sync_from_merge_plan(
                                matched_uuid,
                                plan.tasks,
                                source_external_note_update_id=ext_row.id,
                                timeline=timeline,
                                editor_id=user.id,
                            )

                        await ext_repo.update(
                            ext_row.id,
                            ExternalNoteUpdatePatch(status="merged"),
                        )

                    run_context.output = {
                        "status": "merged",
                        "matched_note_id": str(matched_uuid),
                        "chunks": len(normalized),
                    }
                except Exception as exc:  # noqa: BLE001
                    logging.exception("update-notes workflow failed")
                    try:
                        await ext_repo.update(
                            ext_row.id,
                            ExternalNoteUpdatePatch(
                                status="failed",
                                error_message=str(exc)[:2000],
                            ),
                        )
                    except Exception:  # noqa: BLE001
                        logging.exception("update-notes: could not persist failure status")
                    raise


UpdateNotesWorkflowTaskDep = Annotated[
    UpdateNotesWorkflowTask, Depends(UpdateNotesWorkflowTask)
]
