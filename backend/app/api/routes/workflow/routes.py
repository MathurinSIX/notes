from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.api.routes.note.schemas import UpdateNotesWorkflowResponse
from app.workflows.example_workflow import ExampleWorkflowInput
from app.workflows.update_notes_workflow import UpdateNotesWorkflowInput

from .service import WorkflowServiceDep

load_dotenv()  # this loads .env into os.environ

router = APIRouter(prefix="/workflow", tags=["Workflow"])

OPENAI_KEY_ERROR_MSG = (
    "OPENAI_API_KEY is not configured. "
    "Set OPENAI_API_KEY in your environment to use the summarize workflow."
)


@router.post(
    "/update-notes",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=UpdateNotesWorkflowResponse,
)
async def update_notes_workflow(
    service: WorkflowServiceDep,
    data: UpdateNotesWorkflowInput,
) -> Any:
    """
    Store the update text, then run a background workflow: match the best note
    (OpenAI + summaries), merge the text into that note's chunks (OpenAI), and
    link resulting history rows to the stored update.
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=OPENAI_KEY_ERROR_MSG,
        )
    return await service.run_update_notes_workflow(data=data)


@router.post("/example-workflow", status_code=status.HTTP_200_OK)
async def example_workflow(
    service: WorkflowServiceDep,
    data: ExampleWorkflowInput,
) -> Any:
    """
    Run an example workflow.
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=OPENAI_KEY_ERROR_MSG,
        )
    return await service.run_example_workflow(data=data)
