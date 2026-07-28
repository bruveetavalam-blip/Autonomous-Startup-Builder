from pydantic import BaseModel

class StartupIdea(BaseModel):
    idea: str