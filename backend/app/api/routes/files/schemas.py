import uuid

from pydantic import BaseModel


class PasteImageOut(BaseModel):
    id: uuid.UUID
    """URL path only; resolve with API base for requests (e.g. `/files/paste-images/...`)."""

    path: str
