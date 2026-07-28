"""Business-plan generation service."""

from app.services.llm_service import generate_response


def generate_business_plan(
    idea: str,
    analysis: str | None = None,
    market_insights: dict | None = None,
    competitors: str | None = None,
) -> str:
    """Generate a practical business plan for a startup idea."""
    prompt = f"""
You are a startup strategist. Create a concise, actionable business plan for:
{idea}

Idea analysis:
{analysis or "Not provided"}

Market insights:
{market_insights or "Not provided"}

Competitor research:
{competitors or "Not provided"}

Use exactly these headings: Executive Summary, Problem Statement, Solution,
Target Customers, Business Model, Revenue Model, Technology Stack, Future Scope.
Make realistic assumptions explicit, use bullet points where helpful, and ground
recommendations in the supplied analysis and market evidence.
"""
    return generate_response(prompt)
