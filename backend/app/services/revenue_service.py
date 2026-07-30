"""Financial-estimation generation service."""

from app.services.llm_service import generate_response
from app.services.report_service import extract_json_object


def generate_revenue_estimate(
    idea: str,
    analysis: str | None = None,
    market_insights: dict | None = None,
    business_plan: str | None = None,
    location: dict | None = None,
) -> str:
    """Generate transparent, assumption-based startup financial estimates."""
    prompt = f"""
You are a startup finance analyst. Estimate financials for:
{idea}

Launch location: {location or {"country": "India"}}

Idea analysis:
{analysis or "Not provided"}

Market insights:
{market_insights or "Not provided"}

Business plan:
{business_plan or "Not provided"}

Return ONLY valid JSON in Indian Rupees (INR), using this schema:
{{
  "currency": "INR",
  "startup_cost": {{"items": [{{"name": "", "amount": 0}}], "total": 0}},
  "monthly_expenses": [{{"name": "", "amount": 0}}],
  "revenue_projection": [{{"month": "M1", "revenue": 0, "expenses": 0, "profit": 0}}],
  "break_even_month": 0,
  "funding_requirement": 0,
  "assumptions": [],
  "notes": ""
}}
Use realistic INR values for an Indian startup. Use whole rupee numbers, not
dollars, lakhs, or crores in the JSON. Include 12 monthly projection rows.
Adapt labour, rent, compliance, tax, pricing, and funding assumptions to the location.
"""
    raw = generate_response(prompt)
    parsed = extract_json_object(raw)
    if parsed:
        parsed["currency"] = "INR"
        return parsed
    return {
        "currency": "INR", "startup_cost": {"items": [], "total": 0},
        "monthly_expenses": [], "revenue_projection": [],
        "break_even_month": None, "funding_requirement": 0,
        "assumptions": [raw], "notes": "The finance agent returned unstructured output; retry for a structured model.",
    }
