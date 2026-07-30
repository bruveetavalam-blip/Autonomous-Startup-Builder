"""Marketing strategy generation service."""

from app.services.llm_service import generate_response


def generate_marketing_strategy(
    idea: str,
    analysis: str | None = None,
    market_insights: dict | None = None,
    competitors: str | None = None,
    location: dict | None = None,
) -> str:
    """Generate a launch and growth marketing strategy."""
    prompt = f"""
You are a growth marketing strategist. Build a concrete marketing strategy for:
{idea}

Launch location: {location or {"country": "India"}}

Idea analysis:
{analysis or "Not provided"}

Market insights:
{market_insights or "Not provided"}

Competitor research:
{competitors or "Not provided"}

Use exactly these headings: Target Audience, Marketing Channels, Instagram Strategy,
LinkedIn Strategy, SEO, Content Marketing, Launch Strategy, Growth Plan.
Include practical first 90-day actions, suitable metrics, channel priorities,
and competitor-aware positioning.
Use location-specific channels, language, partnerships, and customer acquisition costs.
"""
    return generate_response(prompt)
