import uuid
from typing import Any

from fastapi import APIRouter, status

from .schemas import {CLASSNAME}Create, {CLASSNAME}Out, {CLASSNAME_PLURAL}Out, {CLASSNAME}Update
from .service import {CLASSNAME}ServiceDep

router = APIRouter(prefix="/{TABLENAME}", tags=["{TAGNAME}"])


@router.get("/{id}", response_model={CLASSNAME}Out, status_code=status.HTTP_200_OK)
async def read_{FUNCNAME}_by_id(service: {CLASSNAME}ServiceDep, id: uuid.UUID) -> Any:
    """
    Get a specific {DOCNAME} by id.
    """
    return await service.read_by_id(id)


@router.get("/", response_model={CLASSNAME_PLURAL}Out, status_code=status.HTTP_200_OK)
async def list_{FUNCNAME_PLURAL}(
    service: {CLASSNAME}ServiceDep, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve {DOCNAME_PLURAL}.
    """
    return await service.list({}, skip, limit)


@router.post("/", response_model={CLASSNAME}Out, status_code=status.HTTP_201_CREATED)
async def create_{FUNCNAME}(service: {CLASSNAME}ServiceDep, data: {CLASSNAME}Create) -> Any:
    """
    Create new {DOCNAME}.
    """
    return await service.create(data)


@router.patch("/{id}", response_model={CLASSNAME}Out, status_code=status.HTTP_201_CREATED)
async def update_{FUNCNAME}(
    service: {CLASSNAME}ServiceDep, id: uuid.UUID, data: {CLASSNAME}Update
) -> Any:
    """
    Update a {DOCNAME}.
    """
    return await service.update(id, data)


@router.delete("/{id}", status_code=status.HTTP_201_CREATED)
async def delete_{FUNCNAME}(service: {CLASSNAME}ServiceDep, id: uuid.UUID) -> Any:
    """
    Delete a {DOCNAME}.
    """
    return await service.delete(id)
