from fastapi import APIRouter, Response

router = APIRouter(tags=["Utils"])


@router.get("/health")
async def health_check() -> Response:
    return True


@router.get("/live")
async def liveness_check() -> Response:
    return Response(content="true", media_type="application/json", status_code=200)