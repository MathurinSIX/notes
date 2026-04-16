from typing import Annotated

from fastapi import Depends
from sqlalchemy import func
from sqlmodel import or_, select

from app.api.routes._shared.repository import BaseRepository
from app.api.routes.run.models import Run

from .models import RunStep


class RunStepRepository(BaseRepository):
    model = RunStep
    options = []

    @staticmethod
    def rls_select(user_id):
        return RunStep.run.has(Run.creator_id == user_id)

    @staticmethod
    def rls_insert(user_id):
        return RunStep.run.has(Run.creator_id == user_id)

    @staticmethod
    def rls_update(user_id):
        return RunStep.run.has(Run.creator_id == user_id)

    @staticmethod
    def rls_delete(user_id):
        return False

    filters = {
        "run_id": lambda values: RunStep.run_id.in_(values),
        "status": lambda values: RunStep.status.in_(values),
        "name": lambda values: RunStep.name.ilike(values),
        "description": lambda values: RunStep.description.ilike(values),
    }

    async def count_documents_for_pattern(
        self,
        status: str,
        description_pattern: str,
        bypass_rls: bool = False,
    ) -> int:
        """Count total documents across all runs that have a step matching the pattern."""
        subq = (
            select(RunStep.run_id)
            .where(
                RunStep.status == status,
                RunStep.description.ilike(description_pattern),
            )
            .where(
                True
                if bypass_rls
                else or_(
                    self.current_user.is_superuser,
                    self.rls_select(self.current_user.id),
                )
            )
            .distinct()
        )
        stmt = (
            select(func.count(RunDocument.id))
            .select_from(RunDocument)
            .where(RunDocument.run_id.in_(subq))
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0


RunStepRepositoryDep = Annotated[RunStepRepository, Depends(RunStepRepository)]
