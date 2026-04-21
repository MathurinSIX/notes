import uuid
from typing import Annotated

from fastapi import Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import CurrentUser, SessionDep

from .models import PastedImage


class PastedImageRepository:
    def __init__(self, session: AsyncSession, current_user: CurrentUser):
        self.session = session
        self.current_user = current_user

    async def create(self, row: PastedImage) -> PastedImage:
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def get_owned(self, image_id: uuid.UUID) -> PastedImage | None:
        stmt = select(PastedImage).where(
            PastedImage.id == image_id,
            PastedImage.user_id == self.current_user.id,
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()


def get_pasted_image_repository(
    session: SessionDep,
    current_user: CurrentUser,
) -> PastedImageRepository:
    return PastedImageRepository(session, current_user)


PastedImageRepositoryDep = Annotated[
    PastedImageRepository,
    Depends(get_pasted_image_repository),
]
