import os
from collections.abc import AsyncGenerator
from typing import Annotated, Any

import boto3
import jwt
from botocore.client import Config
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from google.cloud import storage  # type: ignore
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import or_, select

from app.core import security
from app.core.cache import ttl_cache
from app.core.config import settings
from app.core.db import async_engine

from .routes.login.schemas import TokenPayload
from .routes.user.models import User
from .routes.user_tokens.models import UserToken

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl="/login/access-token")

async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


SessionDep = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_bucket():
    """GCS bucket (google-cloud-storage) when PROVIDER_CREDENTIALS is set; else S3 API (boto3), e.g. MinIO."""
    cred_path = os.environ.get("PROVIDER_CREDENTIALS")
    if cred_path:
        storage_client = storage.Client.from_service_account_json(cred_path)
        return storage_client.bucket(settings.BUCKET_NAME)
    s3 = boto3.resource(
        "s3",
        endpoint_url=str(settings.BUCKET_URL).rstrip("/"),
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name=settings.S3_REGION_NAME,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    return s3.Bucket(settings.BUCKET_NAME)


BucketDep = Annotated[Any, Depends(get_bucket)]

async def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    if token_data.tok_type == "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh tokens cannot be used for API access",
        )
    user = await session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if token_data.tok_type == "user_token":
        is_valid_token = await get_invalid_tokens(session=session, id=token_data.token_id)
        if not is_valid_token:
            raise HTTPException(status_code=400, detail="Invalid Token (Disabled/Deleted)")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user

async def get_invalid_tokens(session: SessionDep, id: str):
    invalid_tokens = ttl_cache.get("invalid_tokens")
    if invalid_tokens is None:
        stmt = select(
                UserToken.id
            ).where(
                or_(
                    UserToken.is_active.is_(False),
                    UserToken.deleted.is_(True),
                )
            )
        user_tokens = await session.execute(stmt)
        invalid_tokens = {str(id_) for id_ in user_tokens.scalars()}
        ttl_cache["invalid_tokens"] = invalid_tokens
    return id not in invalid_tokens

