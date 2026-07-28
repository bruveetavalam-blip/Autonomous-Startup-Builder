from pydantic import BaseModel, Field

class CompetitorRequest(BaseModel):
    idea: str = Field(..., min_length=2, max_length=500)
