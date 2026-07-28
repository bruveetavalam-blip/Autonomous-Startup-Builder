"""Schemas used by the combined startup-builder workflow."""

from pydantic import BaseModel, Field


class StartupBuilderRequest(BaseModel):
    """The idea to research, plan, and persist."""

    idea: str = Field(..., min_length=2, max_length=500)
