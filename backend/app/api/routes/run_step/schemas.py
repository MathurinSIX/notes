import uuid
from datetime import datetime

from sqlmodel import SQLModel

from .._shared.enums import WorkflowStatus


class RunStepCreate(SQLModel):
    run_id: uuid.UUID
    name: str
    description: str
    status: WorkflowStatus
    llm: str | None = None
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    cached_tokens: int | None = None
    llm_cost: float | None = None


class RunStepUpdate(SQLModel):
    run_id: uuid.UUID | None = None
    name: str | None = None
    status: WorkflowStatus
    duration: float | None = None
    llm: str | None = None
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    cached_tokens: int | None = None
    llm_cost: float | None = None
    logs: list[dict] | None = None


class RunStepOut(SQLModel):
    id: uuid.UUID
    run_id: uuid.UUID
    name: str
    status: WorkflowStatus
    llm: str | None = None
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    cached_tokens: int | None = None
    llm_cost: float | None = None
    logs: list[dict] | None
    updated_ts: datetime
    created_ts: datetime


class RunSteps(SQLModel):
    id: uuid.UUID
    name: str
    status: WorkflowStatus
    updated_ts: datetime
    created_ts: datetime


class RunStepsOut(SQLModel):
    data: list[RunSteps]
    count: int
