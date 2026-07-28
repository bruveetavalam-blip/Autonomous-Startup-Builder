"""Financial-estimation generation service."""

from app.services.llm_service import generate_response


def generate_revenue_estimate(idea: str) -> str:
    """Generate transparent, assumption-based startup financial estimates."""
    prompt = f"""
You are a startup finance analyst. Estimate financials for:
{idea}

Use exactly these headings: Startup Cost, Monthly Expenses, Revenue Sources,
Expected Revenue, Profit, Break-even, ROI. State assumptions, use one currency
consistently, and distinguish estimates from facts.
"""
    return generate_response(prompt)
