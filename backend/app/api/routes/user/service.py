import uuid
from typing import Annotated

from fastapi import Depends

from app.api.deps import CurrentUser, SessionDep
from app.api.routes._shared.service import BaseService

from .repository import UserRepositoryDep
from .schemas import UserCreate, UserUpdate


class UserService(BaseService):
    def __init__(
        self,
        repository: UserRepositoryDep,
        session: SessionDep,
        current_user: CurrentUser,
    ) -> None:
        self.repository = repository
        self.session = session
        self.current_user = current_user

    async def itself(self):
        record = await self.repository.read_by_id(self.current_user.id)
        return record

    async def _create(self, data: UserCreate):
        return await super().create(data)

    async def _update(self, id: uuid.UUID, data: UserUpdate):
        return await super().update(id, data)


UserServiceDep = Annotated[UserService, Depends(UserService)]
