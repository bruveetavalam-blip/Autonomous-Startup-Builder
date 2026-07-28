"""Schemas for revenue estimation."""

from pydantic import BaseModel, Field


class RevenueRequest(BaseModel):
    """A startup idea for which to estimate financials."""

    idea: str = Field(..., min_length=2, max_length=500)
