import asyncio
import logging
from collections.abc import Awaitable, Iterable
from typing import Any


def pool(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


async def semaphore(
    tasks: Iterable[Awaitable[Any]],
    max_concurrent: int = 5,
    per_task_timeout: float | None = None,
    return_exceptions: bool = False,
) -> list[Any]:
    """
    Run async tasks with a concurrency limit.

    Args:
        tasks: an iterable of coroutine objects (e.g. [myfunc(i) for i in range(10)])
        max_concurrent: maximum number of tasks running at the same time
        per_task_timeout: optional timeout in seconds for each individual task
        return_exceptions: if True, exceptions are returned as results instead of raising

    Returns:
        A list of results, in the same order as the input tasks
    """
    sem = asyncio.Semaphore(max_concurrent)

    async def sem_task(coro):
        async with sem:
            if per_task_timeout is not None:
                return await asyncio.wait_for(coro, timeout=per_task_timeout)
            return await coro

    logging.info(f"Running {len(tasks)} tasks with max concurrency {max_concurrent}")
    results = await asyncio.gather(
        *(sem_task(t) for t in tasks),
        return_exceptions=return_exceptions,
    )
    logging.info(f"{len(tasks)} tasks completed")

    return results
