import uuid
from datetime import datetime

from pydantic import EmailStr
from sqlmodel import Field, SQLModel


class UserCreate(SQLModel):
    email: EmailStr
    password: str | None = None
    full_name: str | None = None
    is_active: bool = True
    is_superuser: bool = False


class UserUpdate(SQLModel):
    email: EmailStr | None = None
    full_name: str | None = None


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
