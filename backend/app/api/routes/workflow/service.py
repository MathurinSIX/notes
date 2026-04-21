from typing import Annotated

from fastapi import BackgroundTasks, Depends

from app.api.deps import CurrentUser
from app.api.routes.note.repository import ExternalNoteUpdateRepositoryDep
from app.api.routes.note.schemas import (
    ExternalNoteUpdateCreate,
    UpdateNotesWorkflowResponse,
)
from app.core.background_tasks import safe_background_task
from app.workflows.example_workflow import ExampleWorkflowInput, ExampleWorkflowTaskDep
from app.workflows.update_notes_workflow import (
    UpdateNotesWorkflowInput,
    UpdateNotesWorkflowRunParams,
    UpdateNotesWorkflowTaskDep,
)
from app.workflows.utils.loggers import LoggersDep


class WorkflowService:
    def __init__(
        self,
        workflow_logger: LoggersDep,
        background_tasks: BackgroundTasks,
        current_user: CurrentUser,
        example_workflow_task: ExampleWorkflowTaskDep,
        external_note_update_repository: ExternalNoteUpdateRepositoryDep,
        update_notes_workflow_task: UpdateNotesWorkflowTaskDep,
    ) -> None:
        self.workflow_logger = workflow_logger
        self.background_tasks = background_tasks
        self.current_user = current_user
        self.example_workflow_task = example_workflow_task
        self.external_note_update_repository = external_note_update_repository
        self.update_notes_workflow_task = update_notes_workflow_task

    async def run_example_workflow(
        self,
        data: ExampleWorkflowInput,
    ):
        self.background_tasks.add_task(
            safe_background_task,
            self.example_workflow_task.run,
            data=data,
        )

    async def run_update_notes_workflow(
        self,
        data: UpdateNotesWorkflowInput,
    ) -> UpdateNotesWorkflowResponse:
        row = await self.external_note_update_repository.create(
            ExternalNoteUpdateCreate(
                body_md=data.body_md.strip(),
                creator_id=self.current_user.id,
            ),
        )
        self.background_tasks.add_task(
            safe_background_task,
            self.update_notes_workflow_task.run,
            data=UpdateNotesWorkflowRunParams(
                external_note_update_id=row.id,
                fallback_note_id=data.fallback_note_id,
            ),
        )
        return UpdateNotesWorkflowResponse(external_note_update_id=row.id)


WorkflowServiceDep = Annotated[WorkflowService, Depends(WorkflowService)]
