"""Marketing strategy generation service."""

from app.services.llm_service import generate_response


def generate_marketing_strategy(idea: str) -> str:
    """Generate a launch and growth marketing strategy."""
    prompt = f"""
You are a growth marketing strategist. Build a concrete marketing strategy for:
{idea}

Use exactly these headings: Target Audience, Marketing Channels, Instagram Strategy,
LinkedIn Strategy, SEO, Content Marketing, Launch Strategy, Growth Plan.
Include practical first 90-day actions and suitable metrics.
"""
    return generate_response(prompt)
