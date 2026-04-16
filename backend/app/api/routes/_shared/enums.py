from enum import Enum

from pydantic import BaseModel


class WorkflowStatus(str, Enum):
    PENDING = "pending"
    SKIPPED = "skipped"
    STARTED = "started"
    FAILED = "failed"
    SUCCEEDED = "succeeded"
    STOPPED = "stopped"


class ChunkAnnotationType(str, Enum):
    REQUIREMENT = "requirement"
    POLICY = "policy"


class LoaderType(str, Enum):
    CSV = "csv"
    EXCEL = "excel"
    DOCLING = "docling"
    UNSTRUCTURED = "unstructured"


# Pricing Models
class ModelDetails(BaseModel):
    modelname: str
    inputpricing: float
    cachedpricing: float
    outputpricing: float


# Prices per 1M tokens in USD. Link: https://platform.openai.com/docs/pricing
class ModelPricings(Enum):
    GPT4O: BaseModel = ModelDetails(
        inputpricing=2.50,
        cachedpricing=1.25,
        outputpricing=10.00,
        modelname="gpt-4o",
    )

    GPT4OMini: BaseModel = ModelDetails(
        inputpricing=0.15,
        cachedpricing=0.075,
        outputpricing=0.60,
        modelname="gpt-4o-mini",
    )

    GPT41: BaseModel = ModelDetails(
        inputpricing=2.00,
        cachedpricing=0.50,
        outputpricing=8.00,
        modelname="gpt-4.1",
    )

    GPT41Mini: BaseModel = ModelDetails(
        inputpricing=0.40,
        cachedpricing=0.10,
        outputpricing=1.60,
        modelname="gpt-4.1-mini",
    )

    GPT41Nano: BaseModel = ModelDetails(
        inputpricing=0.10,
        cachedpricing=0.025,
        outputpricing=0.40,
        modelname="gpt-4.1-nano",
    )

    O1: BaseModel = ModelDetails(
        inputpricing=15.00,
        cachedpricing=7.50,
        outputpricing=60.00,
        modelname="o1",
    )

    O1Mini: BaseModel = ModelDetails(
        inputpricing=1.10,
        cachedpricing=0.55,
        outputpricing=4.40,
        modelname="o1-mini",
    )

    O1Pro: BaseModel = ModelDetails(
        inputpricing=150.00,
        cachedpricing=0.00,
        outputpricing=600.00,
        modelname="o1-pro",
    )

    O3: BaseModel = ModelDetails(
        inputpricing=2.00,
        cachedpricing=0.50,
        outputpricing=8.00,
        modelname="o3",
    )

    O3Mini: BaseModel = ModelDetails(
        inputpricing=1.10,
        cachedpricing=0.55,
        outputpricing=4.40,
        modelname="o3-mini",
    )

    O4Mini: BaseModel = ModelDetails(
        inputpricing=1.10,
        cachedpricing=0.275,
        outputpricing=4.40,
        modelname="o4-mini",
    )

    Gpt45: BaseModel = ModelDetails(
        inputpricing=0.00,
        cachedpricing=0.00,
        outputpricing=0.00,
        modelname="gpt-4.5-preview",
    )

    GPT5: BaseModel = ModelDetails(
        inputpricing=1.25,
        cachedpricing=0.125,
        outputpricing=10.00,
        modelname="gpt-5",
    )

    GPT5Mini: BaseModel = ModelDetails(
        inputpricing=0.250,
        cachedpricing=0.025,
        outputpricing=2.00,
        modelname="gpt-5-mini",
    )

    @classmethod
    def from_modelname(cls, key: str):
        # lookup by modelname
        for member in cls:
            if member.value.modelname == key:
                return member
        raise KeyError(key)
