from typing import Annotated

from fastapi import Depends, HTTPException
from sqlmodel import or_, select

from app.api.routes._shared.repository import BaseRepository
from app.core import security

from .models import User
from .schemas import UserCreate


class UserRepository(BaseRepository):
    model = User
    options = []

    @staticmethod
    def rls_select(user_id):
        return True

    @staticmethod
    def rls_insert(user_id):
        return False

    @staticmethod
    def rls_update(user_id):
        return User.id == user_id

    @staticmethod
    def rls_delete(user_id):
        return False

    filters = {
        "name": lambda values: or_(
            *[
                User.full_name.ilike(
                    "%" + v.replace("%", "\\%") + "%",
                    escape="\\",
                )
                for v in values
            ]
        ),
    }

    async def read_by_username(self, username: str, bypass_rls: bool = False):
        statement = select(self.model).where(
            self.model.username == username,  # type: ignore
            True
            if bypass_rls
            else or_(
                self.current_user.is_superuser,
                self.rls_select(self.current_user.id),
            ),
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=403)
        return record

    async def create(self, data: UserCreate, bypass_rls: bool = False):
        dumped_data = data.model_dump(exclude={"password"}, exclude_unset=True)
        if data.password:
            dumped_data["hashed_password"] = security.get_password_hash(data.password)
        new_record = self.model.model_validate(dumped_data)
        self.session.add(new_record)

        await self.session.flush()

        statement = select(self.model).where(
            self.model.id == new_record.id,  # type: ignore
            True
            if bypass_rls
            else or_(
                self.current_user.is_superuser,
                self.rls_insert(self.current_user.id),
            ),
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=403)

        await self.session.commit()
        await self.session.refresh(record)
        return await self.read_by_id(new_record.id, bypass_rls=True)


UserRepositoryDep = Annotated[UserRepository, Depends(UserRepository)]
