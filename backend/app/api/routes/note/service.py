import uuid
from typing import Annotated, Any

from fastapi import Depends

from app.api.deps import CurrentUser
from app.api.routes._shared.service import BaseService

from .repository import ChunkRepositoryDep, NoteRepositoryDep
from .schemas import (
    ChunkCreate,
    ChunkCreateInternal,
    ChunkOut,
    ChunkUpdate,
    NoteCreate,
    NoteCreateInternal,
    NoteOut,
    Notes,
    NotesOut,
    NoteUpdate,
)
from .utils import join_chunks_markdown


def _chunk_out(chunk) -> ChunkOut:
    return ChunkOut(
        id=chunk.id,
        note_id=chunk.note_id,
        body_md=chunk.body_md,
        sort_order=chunk.sort_order,
        due_at=chunk.due_at,
        completed=chunk.completed,
        updated_ts=chunk.updated_ts,
        created_ts=chunk.created_ts,
    )


def _note_out(note) -> NoteOut:
    chunks = list(note.chunks or [])
    chunks_sorted = sorted(chunks, key=lambda c: (c.sort_order, c.created_ts))
    return NoteOut(
        id=note.id,
        title=note.title,
        full_markdown=join_chunks_markdown(chunks_sorted),
        chunks=[_chunk_out(c) for c in chunks_sorted],
        updated_ts=note.updated_ts,
        created_ts=note.created_ts,
    )


class NoteService(BaseService):
    def __init__(
        self,
        repository: NoteRepositoryDep,
        chunk_repository: ChunkRepositoryDep,
        current_user: CurrentUser,
    ) -> None:
        self.repository = repository
        self.chunk_repository = chunk_repository
        self.current_user = current_user

    async def get_detail(self, id: uuid.UUID) -> NoteOut:
        note = await self.repository.read_by_id(id)
        return _note_out(note)

    async def create(self, data: NoteCreate) -> NoteOut:
        internal = NoteCreateInternal(
            title=data.title,
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
        return _note_out(note)

    async def list_notes(
        self,
        skip: int,
        limit: int,
    ) -> NotesOut:
        filters: dict[str, list[Any] | None] = {}
        rows = await self.repository.list(filters, skip, limit)
        count = await self.repository.count(filters)
        return NotesOut(
            data=[
                Notes(
                    id=n.id,
                    title=n.title,
                    updated_ts=n.updated_ts,
                    created_ts=n.created_ts,
                )
                for n in rows
            ],
            count=count or 0,
        )

    async def update_note(self, id: uuid.UUID, data: NoteUpdate) -> NoteOut:
        note = await self.repository.update(id, data)
        return _note_out(note)

    async def delete_note(self, id: uuid.UUID) -> None:
        await self.repository.delete(id)


class ChunkService(BaseService):
    def __init__(
        self,
        repository: ChunkRepositoryDep,
        current_user: CurrentUser,
        note_repository: NoteRepositoryDep,
    ) -> None:
        self.repository = repository
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
        return _chunk_out(chunk)

    async def update_chunk(self, id: uuid.UUID, data: ChunkUpdate) -> ChunkOut:
        chunk = await self.repository.update(id, data)
        return _chunk_out(chunk)

    async def delete_chunk(self, id: uuid.UUID) -> None:
        await self.repository.delete(id)


NoteServiceDep = Annotated[NoteService, Depends(NoteService)]
ChunkServiceDep = Annotated[ChunkService, Depends(ChunkService)]
