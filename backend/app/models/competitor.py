from pydantic import BaseModel

class CompetitorRequest(BaseModel):
    idea: str