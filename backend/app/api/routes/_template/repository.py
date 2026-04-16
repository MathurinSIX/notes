from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import selectinload

from app.api.routes._shared.repository import BaseRepository

from .models import {CLASSNAME}


class {CLASSNAME}Repository(BaseRepository):
    model = {CLASSNAME}
    options = []

    @staticmethod
    def rls_select(user_id):
        return False

    @staticmethod
    def rls_insert(user_id):
        return False

    @staticmethod
    def rls_update(user_id):
        return False

    @staticmethod
    def rls_delete(user_id):
        return False


{CLASSNAME}RepositoryDep = Annotated[{CLASSNAME}Repository, Depends({CLASSNAME}Repository)]
