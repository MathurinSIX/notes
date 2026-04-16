import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Query, status

from .schemas import UserCreate, UserOut, UsersOut, UserUpdate
from .service import UserServiceDep

router = APIRouter(prefix="/users", tags=["User"])


@router.get("/self", response_model=UserOut, status_code=status.HTTP_200_OK)
async def self(user_service: UserServiceDep) -> Any:
    """
    Return current user information.
    """
    return await user_service.itself()


@router.get("/{id}", response_model=UserOut, status_code=status.HTTP_200_OK)
async def read_user_by_id(service: UserServiceDep, id: uuid.UUID) -> Any:
    """
    Get a specific user by id.
    """
    return await service.read_by_id(id)


@router.get("/", response_model=UsersOut, status_code=status.HTTP_200_OK)
async def list_users(
    service: UserServiceDep,
    name: Annotated[list[str] | None, Query()] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve users.
    """
    return await service.list(
        {"name": name},
        skip,
        limit,
    )


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(service: UserServiceDep, data: UserCreate) -> Any:
    """
    Create new user.
    """
    return await service._create(data)


@router.patch("/{id}", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def update_user(service: UserServiceDep, id: uuid.UUID, data: UserUpdate) -> Any:
    """
    Update a user.
    """
    return await service._update(id, data)


@router.delete("/{id}", status_code=status.HTTP_201_CREATED)
async def delete_user(service: UserServiceDep, id: uuid.UUID) -> Any:
    """
    Delete a user.
    """
    return await service.delete(id)
