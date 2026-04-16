# Template prestop: check DB connectivity then signal uvicorn to stop.
import logging
import os
import signal
import subprocess
import sys
import time

from sqlmodel import Session, select

from app.core.db import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def graceful_stop_uvicorn() -> int:
    try:
        pid = int(
            subprocess.check_output(
                ["sh", "-lc", "pgrep -o -f 'uvicorn .*main:app'"], text=True
            ).strip()
        )
        os.kill(pid, signal.SIGTERM)
        return 0
    except Exception:
        pass
    try:
        os.kill(1, signal.SIGTERM)
        return 0
    except Exception:
        return 1


def main() -> int:
    logger.info("Running template prestop script")
    connect_deadline = time.time() + 30
    while True:
        try:
            with Session(engine) as s:
                s.exec(select(1))
            break
        except Exception as e:
            if time.time() >= connect_deadline:
                logger.error(f"DB connection failed after retries: {e}")
                return 0
            logger.warning(f"DB not ready yet {e}; retrying...")
            time.sleep(1)
    graceful_stop_uvicorn()
    return 0


if __name__ == "__main__":
    sys.exit(main())
