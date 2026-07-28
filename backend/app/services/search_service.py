"""Tavily-backed market research service."""

import logging
import os
import re
from typing import Any

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def search_market(query: str) -> dict[str, Any]:
    """Search current market information and return source-backed results."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        logger.warning("TAVILY_API_KEY is not configured; skipping market search")
        return {"available": False, "message": "TAVILY_API_KEY is not configured", "results": []}

    try:
        from tavily import TavilyClient

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
                {
                    "title": item.get("title"),
                    "url": item.get("url"),
                    "content": item.get("content"),
                    "score": item.get("score"),
                    "published_date": item.get("published_date"),
                }
                for item in response.get("results", [])
            ],
        }
    except Exception as exc:
        logger.exception("Market search failed")
        return {"available": False, "message": f"Market search failed: {exc}", "results": []}


def process_market_data(market_research: dict[str, Any]) -> dict[str, Any]:
    """Convert raw web-search results into compact structured market evidence."""
    results = market_research.get("results", [])
    combined_text = " ".join(str(item.get("content", "")) for item in results)
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9-]{3,}", combined_text.lower())
    stop_words = {
        "that",
        "this",
        "with",
        "from",
        "have",
        "will",
        "market",
        "startup",
        "business",
        "their",
        "there",
        "which",
        "about",
    }
    frequencies: dict[str, int] = {}
    for token in tokens:
        if token not in stop_words:
            frequencies[token] = frequencies.get(token, 0) + 1
    keywords = [
        word
        for word, _ in sorted(frequencies.items(), key=lambda item: item[1], reverse=True)[:12]
    ]
    sources = [
        {
            "title": item.get("title"),
            "url": item.get("url"),
            "summary": item.get("content"),
            "score": item.get("score"),
            "published_date": item.get("published_date"),
        }
        for item in results
        if item.get("title") or item.get("url") or item.get("content")
    ]
    return {
        "data_available": bool(market_research.get("available")),
        "source_count": len(sources),
        "answer": market_research.get("answer"),
        "keywords": keywords,
        "sources": sources,
    }
