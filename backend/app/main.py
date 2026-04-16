import asyncio
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRoute
from psycopg_pool import AsyncConnectionPool
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import (
    settings,
    setup_logging,
)
from app.helpers import (
    METRICS_QUEUE_MAXSIZE,
    MetricsMiddleware,
    heartbeat,
    metrics_worker,
)

logger = logging.getLogger(__name__)


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Logging setup
    await setup_logging()

    # Background task state
    app.state.background_tasks = {uuid.uuid4(): None}

    # Metrics
    pool = AsyncConnectionPool(str(settings.PG_DATABASE_URI), min_size=1, max_size=5)
    await pool.open()

    app.state.pool = pool
    app.state.metrics_queue = asyncio.Queue(maxsize=METRICS_QUEUE_MAXSIZE)
    app.state.heartbeat_task = asyncio.create_task(heartbeat(pool, interval=5))
    app.state.metrics_worker = asyncio.create_task(
        metrics_worker(pool, app.state.metrics_queue)
    )

    yield

    for task in ("heartbeat_task", "metrics_worker"):
        worker = getattr(app.state, task, None)
        if worker:
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass
    await pool.close()


app = FastAPI(
    title="My Project",
    openapi_url="/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)


app.add_middleware(MetricsMiddleware)


# Global exception handler for debugging - logs but doesn't interfere
@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler that logs full exception details for debugging
    but then re-raises the exception to let normal error handling proceed.
    """
    logger.error(
        f"UNHANDLED EXCEPTION in {request.method} {request.url.path}: {type(exc).__name__}: {str(exc)}",
        exc_info=True,
        extra={
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": str(request.query_params),
            "client": getattr(request.client, "host", "unknown")
            if request.client
            else "unknown",
            "exception_type": type(exc).__name__,
        },
    )
    # Re-raise to let normal error handling proceed
    raise exc


# HTTP exception handler for consistent error responses
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler to ensure consistent error responses."""
    logger.warning(
        f"HTTP exception in {request.method} {request.url}: {exc.status_code} - {exc.detail}",
        extra={
            "method": request.method,
            "url": str(request.url),
            "status_code": exc.status_code,
            "client": getattr(request.client, "host", "unknown")
            if request.client
            else "unknown",
        },
    )
    return await http_exception_handler(request, exc)


# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router)
