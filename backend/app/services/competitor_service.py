import json
import re
from typing import Any

from app.services.llm_service import generate_response


def _location_text(location: dict | None) -> str:
    values = [location.get("city") if isinstance(location, dict) else None, location.get("state") if isinstance(location, dict) else None, location.get("country") if isinstance(location, dict) else None]
    return ", ".join(value for value in values if value) or "India"


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value)


def _normalize_competitor(item: Any, index: int, location: dict | None) -> dict[str, Any]:
    if isinstance(item, dict):
        entry = {
            "name": _clean_text(item.get("name") or item.get("company") or item.get("company_name") or f"Competitor {index}"),
            "geography_tier": _clean_text(item.get("geography_tier") or item.get("tier") or "local"),
            "description": _clean_text(item.get("description") or item.get("summary") or ""),
            "why_relevant": _clean_text(item.get("why_relevant") or item.get("why_it_is_relevant") or item.get("reason") or ""),
            "strengths": item.get("strengths") if isinstance(item.get("strengths"), list) else [
                _clean_text(item.get("strengths"))
            ] if _clean_text(item.get("strengths")) else [],
            "weaknesses": item.get("weaknesses") if isinstance(item.get("weaknesses"), list) else [
                _clean_text(item.get("weaknesses"))
            ] if _clean_text(item.get("weaknesses")) else [],
            "pricing": _clean_text(item.get("pricing") or item.get("price") or ""),
            "target_customers": _clean_text(item.get("target_customers") or item.get("customer_segment") or item.get("audience") or ""),
            "market_position": _clean_text(item.get("market_position") or item.get("positioning") or ""),
            "opportunity_gap": _clean_text(item.get("opportunity_gap") or item.get("positioning_gap") or ""),
            "selected_for": _clean_text(item.get("selected_for") or item.get("selection_reason") or f"Selected as a relevant {(_clean_text(item.get('geography_tier')) or 'local')} competitor for {_location_text(location)}."),
        }
        return entry

    return {
        "name": f"Competitor {index}",
        "geography_tier": "local",
        "description": _clean_text(item),
        "why_relevant": "",
        "strengths": [],
        "weaknesses": [],
        "pricing": "",
        "target_customers": "",
        "market_position": "",
        "opportunity_gap": "",
        "selected_for": f"Selected as a relevant local competitor for {_location_text(location)}.",
    }


def _parse_competitors(raw: str, location: dict | None) -> dict[str, Any]:
    # Providers sometimes wrap otherwise valid JSON in a Markdown code fence.
    raw = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", raw.strip(), flags=re.IGNORECASE)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = None

    if isinstance(payload, dict):
        competitors = payload.get("competitors") if isinstance(payload.get("competitors"), list) else payload.get("items") if isinstance(payload.get("items"), list) else []
        return {
            "summary": _clean_text(payload.get("summary") or payload.get("overview") or f"Competitor scan for {_location_text(location)}."),
            "competitors": [_normalize_competitor(item, index, location) for index, item in enumerate(competitors, start=1)] or [
                _normalize_competitor(payload, 1, location)
            ],
        }

    if isinstance(payload, list):
        return {
            "summary": f"Competitor scan for {_location_text(location)}.",
            "competitors": [_normalize_competitor(item, index, location) for index, item in enumerate(payload, start=1)],
        }

    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    matches = [line for line in lines if re.match(r"^(?:\d+\.|-)\s+", line)]
    if matches:
        return {
            "summary": f"Competitor scan for {_location_text(location)}.",
            "competitors": [_normalize_competitor(match, index, location) for index, match in enumerate(matches, start=1)],
        }

    return {
        "summary": f"Competitor scan for {_location_text(location)}.",
        "competitors": [
            _normalize_competitor(
                {
                    "name": "Competitor snapshot",
                    "description": raw or "The agent returned a narrative competitor summary. Review the details below for positioning and gap analysis.",
                    "why_relevant": "",
                    "strengths": [],
                    "weaknesses": [],
                    "pricing": "",
                    "target_customers": "",
                    "market_position": "",
                    "opportunity_gap": "",
                },
                1,
                location,
            )
        ],
    }


def get_competitors(idea: str, market_research: dict | None = None, location: dict | None = None):
    market_context = ""
    if market_research:
        market_context = f"""
Market search evidence:
{market_research}
"""

    location_text = _location_text(location)
    prompt = f"""
    You are a startup market research expert.

    Startup Idea:
    {idea}

    Business Location:
    {location_text}

    {market_context}

    Find competitors in this order: local, regional, national, then international only if relevant.
    For Indian locations, prioritize neighborhood businesses, carts/outlets,
    regional brands, Indian national chains, and only then global brands.
    Explain why each competitor was selected for this location.

    Return valid JSON only with this exact schema:
    {{
      "summary": "...",
      "competitors": [
        {{
          "name": "",
          "geography_tier": "local|regional|national|international",
          "description": "",
          "why_relevant": "",
          "strengths": [""],
          "weaknesses": [""],
          "pricing": "",
          "target_customers": "",
          "market_position": "",
          "opportunity_gap": "",
          "selected_for": ""
        }}
      ]
    }}

    Mark uncertain claims as assumptions and keep the list concise.
    """

    raw = generate_response(prompt)
    return _parse_competitors(raw, location)
