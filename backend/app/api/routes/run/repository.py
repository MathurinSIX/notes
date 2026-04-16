from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import selectinload
from sqlmodel import or_

from app.api.routes._shared.repository import BaseRepository

from .models import Run


class RunRepository(BaseRepository):
    model = Run
    options = [
        selectinload(Run.created_by),
    ]

    @staticmethod
    def rls_select(user_id):
        return Run.creator_id == user_id

    @staticmethod
    def rls_insert(user_id):
        return True

    @staticmethod
    def rls_update(user_id):
        return Run.creator_id == user_id

    @staticmethod
    def rls_delete(user_id):
        return False

    filters = {
        "workflow": lambda values: Run.workflow.in_(values),
        "status": lambda values: Run.status.in_(values),
        "deleted": lambda values: Run.deleted.in_(values),
        "name": lambda values: or_(
            *[
                Run.name.ilike(
                    "%" + v.replace("%", "\\%").replace("_", "\\_") + "%",
                    escape="\\",
                )
                for v in values
            ]
        ),
    }


RunRepositoryDep = Annotated[RunRepository, Depends(RunRepository)]
