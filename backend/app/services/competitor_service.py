from app.services.llm_service import generate_response

def get_competitors(idea: str, market_research: dict | None = None):
    market_context = ""
    if market_research:
        market_context = f"""
Market search evidence:
{market_research}
"""

    prompt = f"""
    You are a startup market research expert.

    Startup Idea:
    {idea}

    {market_context}

    Find the top 5 competitors using the market evidence when available.

    For each competitor provide:

    1. Name
    2. Description
    3. Strengths
    4. Weaknesses
    5. Positioning gap this startup can exploit

    Return the response in a neat format. Mark uncertain claims as assumptions.
    """

    return generate_response(prompt)
