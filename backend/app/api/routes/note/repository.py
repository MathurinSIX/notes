import uuid
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import or_, select

from app.api.routes._shared.repository import BaseRepository

from .models import Chunk, Note


class NoteRepository(BaseRepository):
    model = Note
    options: list = []

    async def read_by_id(self, id: uuid.UUID, bypass_rls: bool = False):
        statement = (
            select(Note)
            .options(
                selectinload(Note.chunks),
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
