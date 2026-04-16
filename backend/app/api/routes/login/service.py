import uuid
from datetime import timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError

from app.core import security
from app.core.config import settings

from .repository import LoginRepositoryDep
from .schemas import Token, TokenPayload, RefreshTokenRequest


class TokenService:
    def __init__(
        self,
        repository: LoginRepositoryDep,
    ) -> None:
        self.repository = repository

    async def refresh(self, body: RefreshTokenRequest) -> Token:
        try:
            payload = jwt.decode(
                body.refresh_token,
                settings.SECRET_KEY,
                algorithms=[security.ALGORITHM],
            )
            token_data = TokenPayload(**payload)
        except (InvalidTokenError, ValidationError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
        if token_data.tok_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        if not token_data.sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        try:
            user = await self.repository.read_by_id(
                id=uuid.UUID(token_data.sub), bypass_rls=True
            )
        except (ValueError, HTTPException):
            raise HTTPException(status_code=404, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        access_token = security.create_access_token(
            user.id, expires_delta=access_token_expires
        )
        refresh_token = security.create_refresh_token(
            user.id, expires_delta=refresh_token_expires
        )
        return Token(access_token=access_token, refresh_token=refresh_token)

    async def login_password(self, email: str, password: str) -> Token:
        user = await self.repository.read_by_email(email, bypass_rls=True)
        if user is None or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not security.verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        return Token(
            access_token=security.create_access_token(
                user.id, expires_delta=access_token_expires
            ),
            refresh_token=security.create_refresh_token(
                user.id, expires_delta=refresh_token_expires
            ),
        )


TokenServiceDep = Annotated[TokenService, Depends(TokenService)]
