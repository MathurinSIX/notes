import asyncio
import logging
import traceback
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


async def safe_background_task(
    func: Callable[..., Coroutine[Any, Any, Any]], *args, **kwargs
):
    """
    Wrapper for background tasks that ensures exceptions don't propagate to the main response.
    This prevents the "response already started" error when background tasks fail.
    """
    try:
        if asyncio.iscoroutinefunction(func):
            await func(*args, **kwargs)
        else:
            func(*args, **kwargs)
    except asyncio.CancelledError:
        # Handle task cancellation gracefully
        logger.warning(
            f"Background task {func.__name__} was cancelled",
            extra={
                "task_function": func.__name__,
                "task_args": str(args),
                "task_kwargs": str(kwargs),
            },
        )
        raise  # Re-raise CancelledError to properly handle cancellation
    except Exception as e:
        # Log the exception but don't let it propagate
        logger.error(
            f"Background task {func.__name__} failed: {str(e)}",
            exc_info=True,
            extra={
                "task_function": func.__name__,
                "task_args": str(args),
                "task_kwargs": str(kwargs),
                "traceback": traceback.format_exc(),
            },
        )
        # Explicitly don't re-raise to prevent response corruption
