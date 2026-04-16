import asyncio
import json
import logging
import os
import re
from time import perf_counter

from fastapi import Request, Response
from psycopg_pool import AsyncConnectionPool
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

# ---------------------- Config ----------------------
METRICS_QUEUE_MAXSIZE = int(os.getenv("METRICS_QUEUE_MAXSIZE", "10000"))
BATCH_SIZE = int(os.getenv("METRICS_BATCH_SIZE", "200"))
FLUSH_SECS = float(os.getenv("METRICS_FLUSH_SECS", "30"))

RETRY_ATTEMPTS = int(os.getenv("METRICS_RETRY_ATTEMPTS", "3"))
RETRY_BASE_DELAY_SECS = float(os.getenv("METRICS_RETRY_BASE_DELAY_SECS", "2"))

POD_NAME = os.getenv("POD_NAME", "unknown")

MetricItem = tuple[str, str, int, float, str | None, str | None]


# ---------------------- Helpers ----------------------
def _templated_path(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", None) or request.url.path


def _client_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    client = request.client
    return client.host if client else None


async def _insert_batch(pool: AsyncConnectionPool, batch: list[MetricItem]) -> None:
    payload = [
        {
            "method": m,
            "path_template": p,
            "status": s,
            "duration_ms": d,
            "client_ip": cip,
        }
        for (m, p, s, d, cip) in batch
    ]

    table = _qualified_table(settings.POSTGRES_SCHEMA, "http_request_metrics")
    stmt = f"""
        INSERT INTO {table}
        (method, path_template, status, duration_ms, client_ip)
        SELECT x->>'method', x->>'path_template', (x->>'status')::int,
               (x->>'duration_ms')::float, (NULLIF(x->>'client_ip',''))::inet
        FROM jsonb_array_elements(%s::jsonb) AS x
    """

    delay = RETRY_BASE_DELAY_SECS
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(stmt, [json.dumps(payload)])
                    await conn.commit()
            return
        except Exception as e:
            logging.warning(
                "Metrics insert attempt %s/%s failed: %s",
                attempt,
                RETRY_ATTEMPTS,
                str(e),
            )
            if attempt >= RETRY_ATTEMPTS:
                logging.error("Metrics insert giving up after %s attempts", attempt)
                return
            await asyncio.sleep(delay)
            delay *= 2


async def metrics_worker(pool: AsyncConnectionPool, q: asyncio.Queue) -> None:
    batch: list[MetricItem] = []
    while True:
        try:
            try:
                item: MetricItem = await asyncio.wait_for(q.get(), timeout=FLUSH_SECS)
                batch.append(item)
            except asyncio.TimeoutError:
                pass

            while len(batch) < BATCH_SIZE:
                try:
                    batch.append(q.get_nowait())
                except asyncio.QueueEmpty:
                    break

            if not batch:
                continue

            await _insert_batch(pool, batch)
            batch.clear()
        except asyncio.CancelledError:
            if batch:
                await _insert_batch(pool, batch)
            raise
        except Exception:
            batch.clear()


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = perf_counter()
        method = request.method

        try:
            response: Response = await call_next(request)
            path = _templated_path(request)
            status = response.status_code
        except Exception:
            status = 500
            duration_ms = (perf_counter() - start) * 1000.0
            await self.enqueue_metric(
                request, method, request.url.path, status, duration_ms
            )
            raise

        duration_ms = (perf_counter() - start) * 1000.0
        response.headers["X-Process-Time-ms"] = f"{duration_ms:.2f}"
        logging.debug(f"{method} {path} -> {status} in {duration_ms:.2f} ms")
        await self.enqueue_metric(request, method, path, status, duration_ms)
        return response

    async def enqueue_metric(self, request, method, path, status, duration_ms):
        q: asyncio.Queue = getattr(request.app.state, "metrics_queue", None)
        if not q:
            return
        item: MetricItem = (
            method,
            path,
            status,
            duration_ms,
            _client_ip(request),
        )
        try:
            q.put_nowait(item)
        except asyncio.QueueFull:
            pass


def _qualified_table(schema: str, name: str) -> str:
    """Schema-qualified table name for raw SQL. Schema must match [a-zA-Z_][a-zA-Z0-9_-]*."""
    if schema == "public" or not re.match(r"^[a-zA-Z_][a-zA-Z0-9_-]*$", schema):
        return name
    return f'"{schema}".{name}'


async def heartbeat(pool, interval: int = 5):
    table = _qualified_table(settings.POSTGRES_SCHEMA, "app_liveness")
    while True:
        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        f"""
                        INSERT INTO {table} (pod_name, pid)
                        VALUES (%s, %s)
                        """,
                        (
                            POD_NAME,
                            os.getpid(),
                        ),
                    )
                await conn.commit()
        except Exception as e:
            logging.warning(f"[HEARTBEAT ERROR] {e}")
        await asyncio.sleep(interval)


