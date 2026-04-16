import uuid
from datetime import datetime

from sqlmodel import SQLModel


class {CLASSNAME}Create(SQLModel):
    name: str


class {CLASSNAME}Update(SQLModel):
    name: str


class {CLASSNAME}Out(SQLModel):
    id: uuid.UUID
    name: str
    created_ts: datetime


class {CLASSNAME_PLURAL}(SQLModel):
    id: uuid.UUID
    name: str


class {CLASSNAME_PLURAL}Out(SQLModel):
    data: list[{CLASSNAME_PLURAL}]
    count: int
