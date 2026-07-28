"""Schemas for market research and RAG requests."""

from pydantic import BaseModel, Field


class MarketResearchRequest(BaseModel):
    """A startup idea or market query to research."""

    query: str = Field(..., min_length=2, max_length=500)


class RAGQueryRequest(BaseModel):
    """A question to answer from stored startup reports."""

    query: str = Field(..., min_length=2, max_length=500)
    limit: int = Field(default=4, ge=1, le=10)
