import logging
import os
import uuid
from typing import Any

import boto3
from botocore.client import Config
from fastapi import HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from google.cloud.storage import Bucket as GCSBucket

from app.core.config import settings

from .models import PastedImage
from .repository import PastedImageRepository

logger = logging.getLogger(__name__)

_EXT_BY_CT: dict[str, str] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
}


def _object_key(user_id: uuid.UUID, ext: str) -> str:
    name = f"note-pastes/{user_id}/{uuid.uuid4()}{ext}"
    if settings.BUCKET_PREFIX:
        p = settings.BUCKET_PREFIX.strip("/")
        return f"{p}/{name}"
    return name


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=str(settings.BUCKET_URL).rstrip("/"),
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name=settings.S3_REGION_NAME,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def _s3_body_iterator(key: str):
    obj = _s3_client().get_object(Bucket=settings.BUCKET_NAME, Key=key)
    yield from obj["Body"].iter_chunks(chunk_size=64 * 1024)


def _gcs_body_iterator(bucket: GCSBucket, key: str):
    blob = bucket.blob(key)
    with blob.open("rb") as reader:
        while True:
            chunk = reader.read(64 * 1024)
            if not chunk:
                break
            yield chunk


async def upload_paste_image(
    bucket: Any,
    repo: PastedImageRepository,
    file: UploadFile,
) -> PastedImage:
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if not ct.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image uploads are allowed",
        )
    ext = _EXT_BY_CT.get(ct)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: {ct or 'unknown'}",
        )

    content = await file.read()
    if len(content) > settings.NOTE_PASTE_IMAGE_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Image too large (max {settings.NOTE_PASTE_IMAGE_MAX_BYTES // (1024 * 1024)} MB)"
            ),
        )
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )

    key = _object_key(repo.current_user.id, ext)

    try:
        if isinstance(bucket, GCSBucket):
            blob = bucket.blob(key)
            blob.upload_from_string(content, content_type=ct)
        else:
            bucket.put_object(Key=key, Body=content, ContentType=ct)
    except Exception:
        logger.exception("paste-image upload failed for key=%s", key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not store image",
        ) from None

    row = PastedImage(
        user_id=repo.current_user.id,
        object_key=key,
        content_type=ct,
    )
    return await repo.create(row)


def stream_paste_image(bucket: Any, row: PastedImage) -> StreamingResponse:
    try:
        if isinstance(bucket, GCSBucket):
            iterator = _gcs_body_iterator(bucket, row.object_key)
        else:
            iterator = _s3_body_iterator(row.object_key)
    except Exception:
        logger.exception("paste-image read failed for key=%s", row.object_key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not read image",
        ) from None

    return StreamingResponse(
        iterator,
        media_type=row.content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
