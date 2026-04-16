import uuid
from typing import Any

from pydantic import BaseModel

from .repository import BaseRepository


class BaseService:
    def __init__(
        self,
    ) -> None:
        self.repository: BaseRepository
        raise NotImplementedError(
            "BaseService must be initialized with a repository instance dependency."
        )

    async def read_by_id(self, id: uuid.UUID):
        record = await self.repository.read_by_id(id)
        return record

    async def list(
        self,
        filters: dict[str, list[Any] | None],
        skip: int,
        limit: int,
        order_by: str = None,
    ):
        data = await self.repository.list(filters, skip, limit, order_by=order_by)
        count = await self.repository.count(filters)
        return {"data": data, "count": count}

    async def create(self, data: BaseModel):
        return await self.repository.create(data)

    async def update(self, id: uuid.UUID, data: BaseModel):
        return await self.repository.update(id, data)

    async def delete(self, id: uuid.UUID):
        return await self.repository.delete(id)
