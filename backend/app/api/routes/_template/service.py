from typing import Annotated

from fastapi import Depends

from app.api.routes._shared.service import BaseService

from .repository import {CLASSNAME}RepositoryDep


class {CLASSNAME}Service(BaseService):
    def __init__(
        self,
        repository: {CLASSNAME}RepositoryDep,
    ) -> None:
        self.repository = repository


{CLASSNAME}ServiceDep = Annotated[{CLASSNAME}Service, Depends({CLASSNAME}Service)]
