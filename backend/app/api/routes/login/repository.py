from typing import Annotated

from fastapi import Depends
from sqlmodel import or_, select

from app.api.deps import SessionDep
from app.api.routes._shared.repository import BaseRepository

from ..user.models import User


class LoginRepository(BaseRepository):
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

    def __init__(
        self,
        session: SessionDep,
    ) -> None:
        self.session: SessionDep = session
        self.current_user = None  # type: ignore

    async def read_by_email(self, email: str, bypass_rls: bool = False):
        statement = select(self.model).where(
            self.model.email == email,  # type: ignore
            True
            if bypass_rls
            else or_(
                self.current_user.is_superuser,
                self.rls_select(self.current_user.id),
            ),
        )
        result = await self.session.execute(statement)
        record = result.scalar_one_or_none()

        return record


LoginRepositoryDep = Annotated[LoginRepository, Depends(LoginRepository)]
