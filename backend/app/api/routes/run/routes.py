import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Query, status

from .schemas import RunCreate, RunOut, RunsOut, RunUpdate
from .service import RunServiceDep

router = APIRouter(prefix="/run", tags=["Run"])


@router.get("/{id}", response_model=RunOut, status_code=status.HTTP_200_OK)
async def read_run_by_id(service: RunServiceDep, id: uuid.UUID) -> Any:
    """
    Get a specific run by id.
    """
    return await service.read_by_id(id)


@router.get(
    "/download_exported_file/{id}", response_model=None, status_code=status.HTTP_200_OK
)
async def download_exported_file_by_id(service: RunServiceDep, id: uuid.UUID) -> Any:
    """
    Downloads the excel file that was exported using the export workflow
    """
    return await service.download_exported_file(id)


@router.get("/", response_model=RunsOut, status_code=status.HTTP_200_OK)
async def list_runs(
    service: RunServiceDep,
    document_id: Annotated[list[uuid.UUID] | None, Query()] = None,
    workflow: Annotated[list[str] | None, Query()] = None,
    status: Annotated[list[str] | None, Query()] = None,
    deleted: Annotated[list[bool] | None, Query()] = None,
    name: Annotated[list[str] | None, Query()] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve runs.
    """
    return await service.list(
        {
            "document_id": document_id,
            "workflow": workflow,
            "status": status,
            "deleted": deleted,
            "name": name,
        },
        skip,
        limit,
    )


@router.post("/", response_model=RunOut, status_code=status.HTTP_201_CREATED)
async def create_run(service: RunServiceDep, data: RunCreate) -> Any:
    """
    Create new run.
    """
    return await service.create(data)


@router.patch("/{id}", response_model=RunOut, status_code=status.HTTP_201_CREATED)
async def update_run(service: RunServiceDep, id: uuid.UUID, data: RunUpdate) -> Any:
    """
    Update a run.
    """
    return await service.update(id, data)


@router.delete("/{id}", status_code=status.HTTP_201_CREATED)
async def delete_run(service: RunServiceDep, id: uuid.UUID) -> Any:
    """
    Delete a run.
    """
    return await service.delete(id)
