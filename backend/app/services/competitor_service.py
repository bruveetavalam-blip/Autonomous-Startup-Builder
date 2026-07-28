from app.services.llm_service import generate_response

def get_competitors(idea: str):

    prompt = f"""
    You are a startup market research expert.

    Startup Idea:
    {idea}

    Find the top 5 competitors.

    For each competitor provide:

    1. Name
    2. Description
    3. Strengths
    4. Weaknesses

    Return the response in a neat format.
    """

    return generate_response(prompt)