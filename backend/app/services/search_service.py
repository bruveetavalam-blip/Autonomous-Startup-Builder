"""Tavily-backed market research service."""

import logging
import os
from typing import Any

from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()
logger = logging.getLogger(__name__)


def search_market(query: str) -> dict[str, Any]:
    """Search current market information and return source-backed results."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        logger.warning("TAVILY_API_KEY is not configured; skipping market search")
        return {"available": False, "message": "TAVILY_API_KEY is not configured", "results": []}

    try:
        response = TavilyClient(api_key=api_key).search(
            query=f"{query} market trends competitors industry news target audience market size",
            search_depth="advanced",
            max_results=8,
            topic="general",
        )
        return {
            "available": True,
            "query": query,
            "answer": response.get("answer"),
            "results": [
                {"title": item.get("title"), "url": item.get("url"), "content": item.get("content")}
                for item in response.get("results", [])
            ],
        }
    except Exception as exc:
        logger.exception("Market search failed")
        return {"available": False, "message": f"Market search failed: {exc}", "results": []}
