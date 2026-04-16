import uuid
from datetime import datetime

from sqlmodel import SQLModel

from .._shared.enums import WorkflowStatus
from ..user.schemas import Users

class Run(SQLModel):
    id: uuid.UUID
    workflow: str
    status: WorkflowStatus
    created_ts: datetime


class RunCreate(SQLModel):
    id: uuid.UUID | None = None
    name: str | None = None
    workflow: str
    status: WorkflowStatus
    pid: int | None = None
    params: dict | None = None
    output: dict | None = None
    total_steps: int | None = None
    creator_id: uuid.UUID
    pod_name: str


class RunUpdate(SQLModel):
    status: WorkflowStatus
    duration: float
    total_steps: int | None = None
    output: dict | None = None


class RunOut(SQLModel):
    id: uuid.UUID
    name: str
    workflow: str
    status: WorkflowStatus
    created_by: Users
    params: dict | None = None
    output: dict | None = None
    updated_ts: datetime
    created_ts: datetime


class Runs(SQLModel):
    id: uuid.UUID
    name: str
    workflow: str
    status: WorkflowStatus
    created_by: Users
    params: dict | None = None
    output: dict | None = None
    updated_ts: datetime
    created_ts: datetime


class RunsOut(SQLModel):
    data: list[Runs]
    count: int
