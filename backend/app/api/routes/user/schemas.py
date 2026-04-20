import uuid
from datetime import datetime

from pydantic import field_validator
from sqlmodel import Field, SQLModel


class UserCreate(SQLModel):
    username: str = Field(min_length=1, max_length=255)
    password: str | None = None
    full_name: str | None = None
    is_active: bool = True
    is_superuser: bool = False

    @field_validator("username")
    @classmethod
    def username_not_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("username cannot be blank")
        return s


class UserUpdate(SQLModel):
    username: str | None = Field(default=None, min_length=1, max_length=255)
    full_name: str | None = None

    @field_validator("username")
    @classmethod
    def username_strip_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s or None


class UserOut(SQLModel):
    id: uuid.UUID
    full_name: str | None
    is_superuser: bool
    created_ts: datetime


class Users(SQLModel):
    id: uuid.UUID
    full_name: str | None


class UsersOut(SQLModel):
    data: list[Users]
    count: int
