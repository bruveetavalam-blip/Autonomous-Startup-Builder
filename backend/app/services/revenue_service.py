"""Financial-estimation generation service."""

from app.services.llm_service import generate_response


def generate_revenue_estimate(
    idea: str,
    analysis: str | None = None,
    market_insights: dict | None = None,
    business_plan: str | None = None,
) -> str:
    """Generate transparent, assumption-based startup financial estimates."""
    prompt = f"""
You are a startup finance analyst. Estimate financials for:
{idea}

Idea analysis:
{analysis or "Not provided"}

Market insights:
{market_insights or "Not provided"}

Business plan:
{business_plan or "Not provided"}

Use exactly these headings: Startup Cost, Monthly Expenses, Revenue Sources,
Expected Revenue, Profit, Break-even, ROI. State assumptions, use one currency
consistently, distinguish estimates from facts, and include conservative,
base-case, and optimistic ranges.
"""
    return generate_response(prompt)
