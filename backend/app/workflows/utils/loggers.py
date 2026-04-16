import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends
from pydantic import BaseModel

from app.api.deps import CurrentUser, SessionDep
from app.api.routes._shared.enums import WorkflowStatus
from app.api.routes.run.repository import RunRepositoryDep
from app.api.routes.run.schemas import RunCreate, RunUpdate
from app.api.routes.run_step.repository import RunStepRepositoryDep
from app.api.routes.run_step.schemas import RunStepCreate, RunStepUpdate
from app.core.config import run_id_var
from app.workflows.utils.metrics import RunStepMetrics, calculate_llm_cost


class Skipped(Exception):
    pass


class Stopped(Exception):
    pass


class RunContext(BaseModel):
    output: dict | None = None


class WaitForInput(BaseModel):
    exp: str
    max_simultaneous_steps: int | None = 5
    waiting_interval: int = 1  # in seconds
    timeout: int = 7200  # in seconds


class Loggers:
    def __init__(
        self,
        run_repository: RunRepositoryDep,
        runstep_repository: RunStepRepositoryDep,
        session: SessionDep,
        current_user: CurrentUser,
    ):
        self.run_repository = run_repository
        self.runstep_repository = runstep_repository
        self.session = session
        self.current_user = current_user

    async def wait_for(
        self,
        runstep_id: uuid.UUID,
        exp: str,
        max_simultaneous_steps: int | None,
        waiting_interval: int,
        max_waiting_iterations: int,
    ):
        i = 0
        while i < max_waiting_iterations:
            run_steps = await self.runstep_repository.count(
                filters={"status": [WorkflowStatus.STARTED], "description": [exp]},
                bypass_rls=True,
            )
            limit = max_simultaneous_steps or 5
            actual = run_steps

            if actual >= limit:
                msg = (
                    f"Waiting for other steps to finish. Current steps: {actual} "
                    f"(max simultaneous steps={limit})"
                )
                logging.info(msg)
                logging.info(
                    f"[CONCURRENCY] max={limit} actual={actual} "
                    f"waiting={i * waiting_interval}s pattern={exp} pod={os.getenv('POD_NAME', 'unknown')}"
                )
                i += 1
                await asyncio.sleep(waiting_interval)
            else:
                break

        await self.runstep_repository.update(
            id=runstep_id,
            data=RunStepUpdate(
                status=WorkflowStatus.STARTED,
            ),
            bypass_rls=True,
        )

        logging.info(
            f"[CONCURRENCY] STARTED pattern={exp} after_wait={i * waiting_interval}s "
            f"concurrent={actual} max={limit}"
        )

    async def is_workflow_stopped(self, run_id, bypass_rls, process, process_type):
        run = await self.run_repository.read_by_id(run_id, bypass_rls=bypass_rls)
        await self.run_repository.session.refresh(run) # Updated Session Data
        if run.status == WorkflowStatus.STOPPED:
            logging.info(f"{process_type} '{process}' has been stopped.")
            return True
        return False

    @asynccontextmanager
    async def logger_run(
        self,
        workflow: str,
        data: dict | None = None,
        total_steps: int | None = None,
        bypass_rls: bool = False,
        name: str = None,
    ):
        logging.info(f"Starting workflow '{workflow}'")
        pod_name = os.getenv("POD_NAME", "unknown")
        logging.info(f"pod_name is {pod_name}")
        run = await self.run_repository.create(
            data=RunCreate(
                name=data.get("name") or workflow,
                workflow=workflow,
                status=WorkflowStatus.STARTED,
                pid=os.getpid(),
                params=data,
                output=None,
                total_steps=total_steps,
                creator_id=self.current_user.id,
                pod_name=pod_name,
            ),
            bypass_rls=bypass_rls,
        )
        run_id = run.id
        logging.info(f"Created run with ID {run_id}")

        start_time = time.time()
        token = run_id_var.set(run_id)

        run_context = RunContext()
        try:
            yield run_context
        except Exception as e:  # noqa: E722
            elapsed_time = time.time() - start_time

            # Log the actual exception details for debugging
            logging.error(
                f"Workflow '{workflow}' failed with exception: {type(e).__name__}: {str(e)}",
                exc_info=True,
                extra={
                    "workflow": workflow,
                    "run_id": run_id,
                    "duration": elapsed_time,
                },
            )

            logging.warning(
                f"Workflow '{workflow}' failed after {elapsed_time:.2f} seconds"
            )

            is_stopped = await self.is_workflow_stopped(run_id=run_id, bypass_rls=bypass_rls, process=workflow, process_type="Workflow")

            if not is_stopped:
                await self.run_repository.update(
                    id=run_id,
                    data=RunUpdate(
                        status=WorkflowStatus.FAILED,
                        duration=elapsed_time,
                    ),
                    bypass_rls=bypass_rls,
                )
            # Don't re-raise the exception to prevent "response already started" errors
            # The exception has been logged and the workflow marked as failed
            return
        else:
            elapsed_time = time.time() - start_time
            is_stopped = await self.is_workflow_stopped(run_id=run_id, bypass_rls=bypass_rls,process=workflow, process_type="Workflow")

            if not is_stopped:
                await self.run_repository.update(
                    id=run_id,
                    data=RunUpdate(
                        status=WorkflowStatus.SUCCEEDED,
                        output=run_context.output,
                        duration=elapsed_time,
                    ),
                    bypass_rls=bypass_rls,
                )
                logging.info(
                    f"Workflow '{workflow}' succeeded after {elapsed_time:.2f} seconds"
                )
        finally:
            run_id_var.reset(token)

    @asynccontextmanager
    async def logger_step(
        self,
        name: str,
        description: str = "",
        wait_for: WaitForInput | None = None,
        bypass_rls: bool = False,
    ):
        """
        Context manager for logging a step. Captures all logs and stores them in the logs column.
        """

        is_stopped = await self.is_workflow_stopped(run_id= run_id_var.get(), bypass_rls=bypass_rls,process=name, process_type="Step")

        if is_stopped:
            raise Stopped

        logging.info(f"Starting step '{name}'")
        runstep = await self.runstep_repository.create(
            data=RunStepCreate(
                run_id=run_id_var.get(),
                name=name,
                description=description,
                status=WorkflowStatus.STARTED
                if not wait_for
                else WorkflowStatus.PENDING,
            ),
            bypass_rls=bypass_rls,
        )
        runstep_id = runstep.id
        step_logs = []

        class StepLogHandler(logging.Handler):
            def emit(self, record):
                log_entry = {
                    "level": record.levelname,
                    "msg": record.getMessage(),
                    "ts": time.time(),
                    "logger": record.name,
                }
                step_logs.append(log_entry)

        handler = StepLogHandler()
        logging.getLogger().addHandler(handler)
        start_time = time.time()

        if wait_for:
            await self.wait_for(
                runstep_id=runstep_id,
                exp=wait_for.exp,
                max_simultaneous_steps=wait_for.max_simultaneous_steps,
                waiting_interval=wait_for.waiting_interval,
                max_waiting_iterations=wait_for.timeout // wait_for.waiting_interval,
            )

        metrics = RunStepMetrics()
        try:
            yield metrics
        except Skipped:
            elapsed_time = time.time() - start_time

            logging.getLogger().removeHandler(handler)

            await self.runstep_repository.update(
                id=runstep_id,
                data=RunStepUpdate(
                    status=WorkflowStatus.SKIPPED,
                    duration=elapsed_time,
                    logs=step_logs,
                ),
                bypass_rls=bypass_rls,
            )
            logging.info(f"Step '{name}' skipped after {elapsed_time:.2f} seconds")
        except Stopped:
            elapsed_time = time.time() - start_time

            logging.getLogger().removeHandler(handler)

            await self.runstep_repository.update(
                id=runstep_id,
                data=RunStepUpdate(
                    status=WorkflowStatus.STOPPED,
                    duration=elapsed_time,
                    logs=step_logs,
                    llm=metrics.llm,
                    prompt_tokens=metrics.prompt_tokens,
                    output_tokens=metrics.output_tokens,
                    cached_tokens=metrics.cached_tokens,
                    llm_cost=calculate_llm_cost(metrics),
                ),
                bypass_rls=bypass_rls,
            )
            logging.warning(f"Step '{name}' stopped after {elapsed_time:.2f} seconds")
        except Exception as e:  # noqa: E722
            elapsed_time = time.time() - start_time
            await self.session.rollback()  # Ensure session is clean

            # Log the actual exception details for debugging
            logging.error(
                f"Step '{name}' failed with exception: {type(e).__name__}: {str(e)}",
                exc_info=True,
                extra={
                    "step_name": name,
                    "step_description": description,
                    "run_id": run_id_var.get(),
                    "duration": elapsed_time,
                },
            )

            logging.getLogger().removeHandler(handler)

            await self.runstep_repository.update(
                id=runstep_id,
                data=RunStepUpdate(
                    status=WorkflowStatus.FAILED,
                    duration=elapsed_time,
                    logs=step_logs,
                    llm=metrics.llm,
                    prompt_tokens=metrics.prompt_tokens,
                    output_tokens=metrics.output_tokens,
                    cached_tokens=metrics.cached_tokens,
                    llm_cost=calculate_llm_cost(metrics),
                ),
                bypass_rls=bypass_rls,
            )
            logging.warning(f"Step '{name}' failed after {elapsed_time:.2f} seconds")
            raise e
        else:
            elapsed_time = time.time() - start_time
            logging.getLogger().removeHandler(handler)
            await self.runstep_repository.update(
                id=runstep_id,
                data=RunStepUpdate(
                    status=WorkflowStatus.SUCCEEDED,
                    duration=elapsed_time,
                    logs=step_logs,
                    llm=metrics.llm,
                    prompt_tokens=metrics.prompt_tokens,
                    output_tokens=metrics.output_tokens,
                    cached_tokens=metrics.cached_tokens,
                    llm_cost=calculate_llm_cost(metrics),
                ),
                bypass_rls=bypass_rls,
            )
            logging.info(f"Step '{name}' succeeded after {elapsed_time:.2f} seconds")


LoggersDep = Annotated[Loggers, Depends(Loggers)]
