from pydantic import BaseModel
from app.api.routes._shared.enums import ModelPricings
import logging

class RunStepMetrics(BaseModel):
    """ 
    Model to store Metrics for Run Step.
    """
    llm: str = "gpt-5"
    prompt_tokens: int = 0
    cached_tokens: int = 0
    output_tokens: int = 0
    llm_cost: float = 0.00

def set_token_usage(token_usage: dict, metrics: RunStepMetrics):
    """Set Token Values in Metrics from Token Usage.

    Args:
        token_usage (dict): Token Usage of LLM call
        metrics (RunStepMetrics): Object holding token values
    """
    logging.info(f"Token Usage: {token_usage}")
    metrics.prompt_tokens += token_usage["prompt_tokens"]
    metrics.output_tokens += token_usage["completion_tokens"]
    metrics.cached_tokens += token_usage["prompt_tokens_details"]["cached_tokens"]

def calculate_llm_cost(metrics: RunStepMetrics):
    """Calculate cost of LLM call using Input, Output and Cache Token.

    Args:
        metrics (RunStepMetrics): Object holding token values

    Returns: Total cost of LLM Call
    """
    pricing_details = ModelPricings.from_modelname(metrics.llm).value

    inputcost = pricing_details.inputpricing * (metrics.prompt_tokens - metrics.cached_tokens) / 1000000
    outputcost = pricing_details.outputpricing * metrics.output_tokens / 1000000
    cachecost = pricing_details.cachedpricing * metrics.cached_tokens / 1000000
    return inputcost + outputcost + cachecost