from fastapi import APIRouter
from app.models.startup import StartupIdea
from app.services.llm_service import generate_response

router = APIRouter()

@router.post("/analyze")
def analyze(idea: StartupIdea):

    prompt = f"""
    Analyze the following startup idea.

    Startup Idea:
    {idea.idea}

    Give:

    1. One-line summary
    2. Target customers
    3. Business category
    """

    result = generate_response(prompt)

    return {
        "startup": idea.idea,
        "analysis": result
    }