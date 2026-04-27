import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Body, HTTPException, Query, status

from app.api.routes.workflow.service import WorkflowServiceDep
from app.core.config import settings

from .schemas import (
    ChunkCreate,
    ChunkOut,
    ChunkTimelineOut,
    ChunkUpdate,
    ExternalNoteUpdateOut,
    ExternalNoteUpdatesOut,
    ExternalNoteUpdatesPageOut,
    NoteCreate,
    SentExternalNoteReapplyBody,
    NoteOut,
    NotesOut,
    NoteTaskPatch,
    NoteTimelineOut,
    NoteUpdate,
    UpdateNotesWorkflowResponse,
)
from .service import ChunkServiceDep, NoteServiceDep

router = APIRouter(prefix="/notes", tags=["Notes"])
chunks_router = APIRouter(prefix="/chunks", tags=["Notes"])

OPENAI_KEY_ERROR_MSG = (
    "OPENAI_API_KEY is not configured. "
    "Set OPENAI_API_KEY in your environment to use the update-notes workflow."
)


@router.get(
    "/sent-updates",
    response_model=ExternalNoteUpdatesPageOut,
    status_code=status.HTTP_200_OK,
)
async def list_sent_external_note_updates(
    service: NoteServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> Any:
    return await service.list_my_external_note_updates(skip=skip, limit=limit)


@router.post(
    "/sent-updates/{update_id}/undo",
    response_model=ExternalNoteUpdateOut,
    status_code=status.HTTP_200_OK,
)
async def undo_sent_external_note_update(
    service: NoteServiceDep,
    update_id: uuid.UUID,
) -> Any:
    """Restore the matched note to its pre-merge state using stored history."""
    return await service.undo_merged_external_note_update(update_id)


@router.post(
    "/sent-updates/{update_id}/reapply",
    response_model=UpdateNotesWorkflowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def reapply_sent_external_note_update(
    note_service: NoteServiceDep,
    workflow_service: WorkflowServiceDep,
    update_id: uuid.UUID,
    body: SentExternalNoteReapplyBody,
) -> Any:
    """
    Undo the merge if it is still applied (when status is merged), point the stored
    update at another note, and queue the merge workflow again (matcher skipped).

    When status is awaiting_note (automatic match found no note), skips undo and
    only queues merge into target_note_id.
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=OPENAI_KEY_ERROR_MSG,
        )
    await note_service.prepare_sent_update_merge_rerun(update_id, body.target_note_id)
    workflow_service.enqueue_update_notes_rerun(
        external_note_update_id=update_id,
        fallback_note_id=body.target_note_id,
        force_matched_note_id=body.target_note_id,
    )
    return UpdateNotesWorkflowResponse(external_note_update_id=update_id)


@router.get("/{note_id}", response_model=NoteOut, status_code=status.HTTP_200_OK)
async def read_note(service: NoteServiceDep, note_id: uuid.UUID) -> Any:
    return await service.get_detail(note_id)


@router.get(
    "/{note_id}/history",
    response_model=NoteTimelineOut,
    status_code=status.HTTP_200_OK,
)
async def read_note_history(
    service: NoteServiceDep,
    note_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    return await service.get_timeline(note_id, skip=skip, limit=limit)


@router.get(
    "/{note_id}/chunks/{chunk_id}/history",
    response_model=ChunkTimelineOut,
    status_code=status.HTTP_200_OK,
)
async def read_chunk_history(
    service: NoteServiceDep,
    note_id: uuid.UUID,
    chunk_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    return await service.get_chunk_timeline(
        note_id, chunk_id, skip=skip, limit=limit
    )


@router.get(
    "/{note_id}/incoming-updates",
    response_model=ExternalNoteUpdatesOut,
    status_code=status.HTTP_200_OK,
)
async def list_note_incoming_updates(
    service: NoteServiceDep,
    note_id: uuid.UUID,
    chunk_id: uuid.UUID | None = Query(None),
) -> Any:
    return await service.list_incoming_updates(note_id, chunk_id=chunk_id)


@router.get(
    "/{note_id}/incoming-updates/{update_id}",
    response_model=ExternalNoteUpdateOut,
    status_code=status.HTTP_200_OK,
)
async def read_note_incoming_update(
    service: NoteServiceDep,
    note_id: uuid.UUID,
    update_id: uuid.UUID,
) -> Any:
    return await service.get_incoming_update_for_note(note_id, update_id)


@router.patch(
    "/{note_id}/tasks/{task_id}",
    response_model=NoteOut,
    status_code=status.HTTP_200_OK,
)
async def patch_note_task(
    service: NoteServiceDep,
    note_id: uuid.UUID,
    task_id: uuid.UUID,
    data: NoteTaskPatch,
) -> Any:
    return await service.patch_note_task(note_id, task_id, data)


@router.get("/", response_model=NotesOut, status_code=status.HTTP_200_OK)
async def list_notes(
    service: NoteServiceDep,
    skip: int = 0,
    limit: int = 100,
    archived: bool = False,
) -> Any:
    return await service.list_notes(skip, limit, archived=archived)


@router.post("/", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    service: NoteServiceDep,
    data: Annotated[NoteCreate | None, Body()] = None,
) -> Any:
    return await service.create(data or NoteCreate())


@router.patch("/{note_id}", response_model=NoteOut, status_code=status.HTTP_200_OK)
async def update_note(
    service: NoteServiceDep,
    note_id: uuid.UUID,
    data: NoteUpdate,
) -> Any:
    return await service.update_note(note_id, data)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(service: NoteServiceDep, note_id: uuid.UUID) -> None:
    await service.delete_note(note_id)


@router.post("/{note_id}/chunks", response_model=ChunkOut, status_code=status.HTTP_201_CREATED)
async def create_chunk(
    service: ChunkServiceDep,
    note_id: uuid.UUID,
    data: ChunkCreate,
) -> Any:
    return await service.create_chunk(note_id, data)


@chunks_router.patch("/{chunk_id}", response_model=ChunkOut, status_code=status.HTTP_200_OK)
async def update_chunk(
    service: ChunkServiceDep,
    chunk_id: uuid.UUID,
    data: ChunkUpdate,
) -> Any:
    return await service.update_chunk(chunk_id, data)


@chunks_router.delete("/{chunk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chunk(service: ChunkServiceDep, chunk_id: uuid.UUID) -> None:
    await service.delete_chunk(chunk_id)
