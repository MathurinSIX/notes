from sqlmodel import SQLModel
from typing import Optional


class Token(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(SQLModel):
    refresh_token: str


class TokenPayload(SQLModel):
    sub: str | None = None
    tok_type: str
    token_id: Optional[str] = None
