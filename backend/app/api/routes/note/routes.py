import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Body, status

from .schemas import ChunkCreate, ChunkOut, ChunkUpdate, NoteCreate, NoteOut, NotesOut, NoteUpdate
from .service import ChunkServiceDep, NoteServiceDep

router = APIRouter(prefix="/notes", tags=["Notes"])
chunks_router = APIRouter(prefix="/chunks", tags=["Notes"])


@router.get("/{note_id}", response_model=NoteOut, status_code=status.HTTP_200_OK)
async def read_note(service: NoteServiceDep, note_id: uuid.UUID) -> Any:
    return await service.get_detail(note_id)


@router.get("/", response_model=NotesOut, status_code=status.HTTP_200_OK)
async def list_notes(
    service: NoteServiceDep,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    return await service.list_notes(skip, limit)


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
