import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.api.deps import BucketDep, CurrentUser

from .repository import PastedImageRepositoryDep
from .schemas import PasteImageOut
from .service import stream_paste_image, upload_paste_image

router = APIRouter(prefix="/files", tags=["Files"])


@router.post(
    "/paste-image",
    response_model=PasteImageOut,
    status_code=status.HTTP_201_CREATED,
)
async def paste_image(
    _user: CurrentUser,
    bucket: BucketDep,
    repo: PastedImageRepositoryDep,
    file: Annotated[UploadFile, File(description="Image pasted from the client")],
) -> PasteImageOut:
    row = await upload_paste_image(bucket, repo, file)
    return PasteImageOut(id=row.id, path=f"/files/paste-images/{row.id}")


@router.get("/paste-images/{image_id}")
async def read_paste_image(
    _user: CurrentUser,
    image_id: uuid.UUID,
    bucket: BucketDep,
    repo: PastedImageRepositoryDep,
) -> StreamingResponse:
    row = await repo.get_owned(image_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return stream_paste_image(bucket, row)
