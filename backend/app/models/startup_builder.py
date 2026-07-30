"""Schemas used by the combined startup-builder workflow."""

from pydantic import BaseModel, Field


class StartupBuilderRequest(BaseModel):
    """The idea to research, plan, and persist."""

    idea: str = Field(..., min_length=2, max_length=500)
    country: str = Field(default="India", max_length=80)
    state: str = Field(default="", max_length=80)
    city: str = Field(default="", max_length=80)
