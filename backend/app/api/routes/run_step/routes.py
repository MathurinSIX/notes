import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Query, status

from .schemas import RunStepCreate, RunStepOut, RunStepsOut, RunStepUpdate
from .service import RunStepServiceDep

router = APIRouter(prefix="/run_step", tags=["Run Step"])


@router.get("/{id}", response_model=RunStepOut, status_code=status.HTTP_200_OK)
async def read_runstep_by_id(service: RunStepServiceDep, id: uuid.UUID) -> Any:
    """
    Get a specific run step by id.
    """
    return await service.read_by_id(id)


@router.get("/", response_model=RunStepsOut, status_code=status.HTTP_200_OK)
async def list_runsteps(
    service: RunStepServiceDep,
    run_id: Annotated[list[uuid.UUID] | None, Query()] = None,
    status: Annotated[list[str] | None, Query()] = None,
    name: Annotated[list[str] | None, Query()] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve run steps.
    """
    return await service.list(
        {
            "run_id": run_id,
            "status": status,
            "name": name,
        },
        skip,
        limit,
    )


@router.post("/", response_model=RunStepOut, status_code=status.HTTP_201_CREATED)
async def create_runstep(service: RunStepServiceDep, data: RunStepCreate) -> Any:
    """
    Create new run step.
    """
    return await service.create(data)


@router.patch("/{id}", response_model=RunStepOut, status_code=status.HTTP_201_CREATED)
async def update_runstep(
    service: RunStepServiceDep, id: uuid.UUID, data: RunStepUpdate
) -> Any:
    """
    Update a run step.
    """
    return await service.update(id, data)


@router.delete("/{id}", status_code=status.HTTP_201_CREATED)
async def delete_runstep(service: RunStepServiceDep, id: uuid.UUID) -> Any:
    """
    Delete a run step.
    """
    return await service.delete(id)
