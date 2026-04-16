from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from .schemas import Token, RefreshTokenRequest
from .service import TokenServiceDep

router = APIRouter(prefix="/login", tags=["Login"])


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh_token(
    token_service: TokenServiceDep,
    body: RefreshTokenRequest,
) -> Token:
    """
    Get a new access token and refresh token using a valid refresh token.
    """
    return await token_service.refresh(body)


@router.post("/access-token", status_code=status.HTTP_200_OK)
async def login_access_token(
    token_service: TokenServiceDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    """
    OAuth2-compatible login: ``username`` is the user's email, ``password`` is their password.
    """
    return await token_service.login_password(form_data.username, form_data.password)
