"""Utilities for structured startup reports and validation."""

from __future__ import annotations

import json
import re
from typing import Any

from app.services.llm_service import generate_response


def extract_json_object(text: str) -> dict[str, Any] | None:
    """Parse the first JSON object from model output."""
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return None
    try:
        value = json.loads(match.group(0))
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        return None


def coerce_score(value: Any, default: int = 50) -> int:
    """Normalize a score to 0-100."""
    try:
        score = int(float(value))
    except (TypeError, ValueError):
        score = default
    return max(0, min(100, score))


def build_sources(market_insights: dict[str, Any] | None, collected: list[dict[str, Any]] | None = None) -> list[dict[str, str]]:
    """Return compact citation-ready source metadata."""
    sources: list[dict[str, str]] = []
    for item in (market_insights or {}).get("sources", []):
        title = item.get("title") or "Untitled source"
        url = item.get("url") or ""
        if url:
            sources.append({"title": str(title), "url": str(url), "description": str(item.get("summary") or item.get("description") or "Market evidence used by the research agent."), "agent": str(item.get("agent") or "Market Research"), "group": str(item.get("group") or "Market Research")})
    for item in collected or []:
        if item.get("url"):
            sources.append({key: str(item.get(key) or "") for key in ("title", "url", "description", "agent", "group")})
    # Deduplicate URLs because both research agents can find the same source.
    unique: dict[str, dict[str, str]] = {}
    for source in sources:
        if source["url"]:
            unique.setdefault(source["url"], source)
    return list(unique.values())


def validate_startup_package(package: dict[str, Any]) -> dict[str, Any]:
    """Critic agent that scores completeness, feasibility, and risk."""
    prompt = f"""
You are a strict startup-investment review agent.

Review this generated startup package and return ONLY valid JSON.

Startup package:
{json.dumps(package, ensure_ascii=False, default=str)}

Required JSON schema:
{{
  "overall_score": 0,
  "market_potential": 0,
  "competition_risk": 0,
  "revenue_feasibility": 0,
  "execution_difficulty": 0,
  "missing_evidence": [],
  "strong_points": [],
  "weak_points": [],
  "risks": [],
  "recommendations": [],
  "panel_verdict": "",
  "next_actions": []
}}

Scores must be integers from 0 to 100. Be ruthless but fair.
"""
    raw = generate_response(prompt, temperature=0.2)
    parsed = extract_json_object(raw) or {}
    return {
        "overall_score": coerce_score(parsed.get("overall_score")),
        "market_potential": coerce_score(parsed.get("market_potential")),
        "competition_risk": coerce_score(parsed.get("competition_risk")),
        "revenue_feasibility": coerce_score(parsed.get("revenue_feasibility")),
        "execution_difficulty": coerce_score(parsed.get("execution_difficulty")),
        "missing_evidence": parsed.get("missing_evidence") or [],
        "strong_points": parsed.get("strong_points") or [],
        "weak_points": parsed.get("weak_points") or [],
        "risks": parsed.get("risks") or [],
        "recommendations": parsed.get("recommendations") or [],
        "panel_verdict": parsed.get("panel_verdict") or raw,
        "next_actions": parsed.get("next_actions") or [],
    }


def build_structured_report(package: dict[str, Any]) -> dict[str, Any]:
    """Create a stable panel-friendly report object."""
    sources = build_sources(package.get("market_insights"), package.get("source_collector"))
    revenue = package.get("revenue")
    return {
        "startup": package.get("idea") or package.get("startup"),
        "location": package.get("location") or {"country": "India", "state": "", "city": ""},
        "workflow": package.get("workflow"),
        "history_id": package.get("history_id"),
        "chroma_document_id": package.get("chroma_document_id"),
        "analysis": package.get("analysis"),
        "market": {
            "available": package.get("market_research", {}).get("available", False),
            "insights": package.get("market_insights", {}),
            "sources": sources,
        },
        "sources": sources,
        "competitors": package.get("competitors"),
        "business_plan": package.get("business_plan"),
        "marketing_strategy": package.get("marketing"),
        "revenue_estimate": revenue,
        "validation": package.get("validation", {}),
        "agent_status": package.get("agent_status", {}),
        "errors": package.get("errors", {}),
        "warnings": [
            value
            for value in [package.get("storage_warning")]
            if isinstance(value, str) and value
        ],
    }
