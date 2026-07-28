"""Request and response schemas for business-plan generation."""

from pydantic import BaseModel, Field


class BusinessPlanRequest(BaseModel):
    """A startup idea for which to create a business plan."""

    idea: str = Field(..., min_length=2, max_length=500)
