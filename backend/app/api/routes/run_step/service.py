from typing import Annotated

from fastapi import Depends

from app.api.routes._shared.service import BaseService

from .repository import RunStepRepositoryDep


class RunStepService(BaseService):
    def __init__(
        self,
        repository: RunStepRepositoryDep,
    ) -> None:
        self.repository = repository


RunStepServiceDep = Annotated[RunStepService, Depends(RunStepService)]
