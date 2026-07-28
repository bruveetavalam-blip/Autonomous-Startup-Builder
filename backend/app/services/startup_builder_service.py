"""Orchestrates the complete autonomous startup-builder workflow."""

import logging
from typing import Any
from app.database.db import save_startup
from app.services.business_service import generate_business_plan
from app.services.chroma_service import store_startup_package
from app.services.competitor_service import get_competitors
from app.services.llm_service import generate_response
from app.services.marketing_service import generate_marketing_strategy
from app.services.revenue_service import generate_revenue_estimate
from app.services.search_service import search_market

logger = logging.getLogger(__name__)

def analyze_startup(idea: str) -> str:
    """Create the core startup analysis reused by the full workflow."""
    prompt = f"Analyze this startup idea: {idea}. Provide a one-line summary, target customers, business category, value proposition, and key risks. Keep it concise and actionable."
    return generate_response(prompt)

def build_startup_package(idea: str) -> dict[str, Any]:
    """Generate, persist, and return all reports for a startup idea."""
    analysis = analyze_startup(idea)
    market_research = search_market(idea)
    competitors = get_competitors(idea)
    business_plan = generate_business_plan(idea)
    marketing = generate_marketing_strategy(idea)
    revenue = generate_revenue_estimate(idea)
    package: dict[str, Any] = {"startup": idea, "analysis": analysis, "market_research": market_research, "competitors": competitors, "business_plan": business_plan, "marketing": marketing, "revenue": revenue}
    history_id = save_startup(idea, analysis, competitors, business_plan, marketing, revenue)
    package["history_id"] = history_id
    try:
        package["chroma_document_id"] = store_startup_package(idea, package, history_id)
    except Exception:
        logger.exception("ChromaDB storage failed for startup history id %s", history_id)
        package["chroma_document_id"] = None
        package["storage_warning"] = "Vector storage was unavailable; the package was saved to SQLite."
    return package
