"""Schemas for marketing strategy generation."""

from pydantic import BaseModel, Field


class MarketingRequest(BaseModel):
    """A startup idea for which to create a marketing strategy."""

    idea: str = Field(..., min_length=2, max_length=500)
