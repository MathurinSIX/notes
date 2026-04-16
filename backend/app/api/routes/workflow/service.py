from typing import Annotated

from fastapi import BackgroundTasks, Depends

from app.api.deps import CurrentUser
from app.core.background_tasks import safe_background_task
from app.workflows.example_workflow import ExampleWorkflowInput, ExampleWorkflowTaskDep
from app.workflows.utils.loggers import LoggersDep


class WorkflowService:
    def __init__(
        self,
        workflow_logger: LoggersDep,
        background_tasks: BackgroundTasks,
        current_user: CurrentUser,
        example_workflow_task: ExampleWorkflowTaskDep,
    ) -> None:
        self.workflow_logger = workflow_logger
        self.background_tasks = background_tasks
        self.current_user = current_user
        self.example_workflow_task = example_workflow_task

    async def run_example_workflow(
        self,
        data: ExampleWorkflowInput,
    ):
        self.background_tasks.add_task(
            safe_background_task,
            self.example_workflow_task.run,
            data=data,
        )


WorkflowServiceDep = Annotated[WorkflowService, Depends(WorkflowService)]
