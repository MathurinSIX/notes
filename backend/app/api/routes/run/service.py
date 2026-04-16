from typing import Annotated

from fastapi import Depends

from app.api.routes._shared.service import BaseService

from .repository import RunRepositoryDep


class RunService(BaseService):
    def __init__(
        self,
        repository: RunRepositoryDep,
    ) -> None:
        self.repository = repository


RunServiceDep = Annotated[RunService, Depends(RunService)]
