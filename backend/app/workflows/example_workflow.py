import logging
import time
from typing import Annotated

from fastapi import Depends
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, SecretStr

from app.core.config import settings
from app.workflows.utils.metrics import set_token_usage

from .utils.loggers import LoggersDep, WaitForInput


class ExampleWorkflowInput(BaseModel):
    text: str

class Summary(BaseModel):
    summary: str = Field(
        description="Summary of the giventext"
    )


class ExampleWorkflowTask:
    def __init__(
        self,
        loggers: LoggersDep,
    ) -> None:
        self.loggers = loggers

    async def run(
        self,
        data: ExampleWorkflowInput,
    ):
        total_steps = 2
        async with self.loggers.logger_run(
            workflow="example-workflow",
            data=data.model_dump(mode="json"),
            total_steps=total_steps,
        ) as run_context:
            async with self.loggers.logger_step(
                    name="Summarize text",
                    description="Summarize text",
                    wait_for=WaitForInput(
                        exp="Summarize%",
                        max_simultaneous_steps=1,
                    ),
                ) as metrics:
                    # Load model
                    if settings.OPENAI_API_KEY is None:
                        raise ValueError(
                            "OPENAI_API_KEY is required for this workflow. "
                            "Set OPENAI_API_KEY in your environment."
                        )
                    model = ChatOpenAI(
                        api_key=SecretStr(settings.OPENAI_API_KEY),
                        model="gpt-5",
                    )
                    logging.info(f"Using model: {model.model_name}")

                    # Structure output
                    llm = model.with_structured_output(Summary, include_raw=True)  # noqa: UP006

                    # Ask the question
                    start_time = time.time()

                    prompt = f"""Summarize the given text:
{data.text}"""

                    # Generate requirements
                    result = await llm.ainvoke(prompt)
                    summary = result["parsed"]

                    token_usage = result["raw"].response_metadata["token_usage"]
                    set_token_usage(
                        token_usage=token_usage,
                        metrics=metrics
                    )

                    duration = round(time.time() - start_time, 2)
                    logging.info(f"{model.model_name} answered in {duration}s")

            async with self.loggers.logger_step(
                name="Save response",
                description="Save response",
            ):
                logging.info(f"Input data: {data.text}")
                logging.info(f"Summary: {summary}")
                run_context.output = {
                    "summary": summary,
                }


ExampleWorkflowTaskDep = Annotated[ExampleWorkflowTask, Depends(ExampleWorkflowTask)]
