"""Business-plan generation service."""

from app.services.llm_service import generate_response


def generate_business_plan(idea: str) -> str:
    """Generate a practical business plan for a startup idea."""
    prompt = f"""
You are a startup strategist. Create a concise, actionable business plan for:
{idea}

Use exactly these headings: Executive Summary, Problem Statement, Solution,
Target Customers, Business Model, Revenue Model, Technology Stack, Future Scope.
Make realistic assumptions explicit and use bullet points where helpful.
"""
    return generate_response(prompt)
