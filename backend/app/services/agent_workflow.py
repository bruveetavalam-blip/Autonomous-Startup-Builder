"""LangGraph multi-agent workflow for autonomous startup generation."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from app.database.db import save_startup, update_startup_report
from app.services.business_service import generate_business_plan
from app.services.chroma_service import store_startup_package
from app.services.competitor_service import get_competitors
from app.services.marketing_service import generate_marketing_strategy
from app.services.report_service import build_structured_report, validate_startup_package
from app.services.revenue_service import generate_revenue_estimate
from app.services.search_service import process_market_data, search_market
from app.services.startup_builder_service import analyze_startup

logger = logging.getLogger(__name__)


class StartupWorkflowState(TypedDict, total=False):
    """Shared state passed between startup-builder agents."""

    idea: str
    analysis: str
    market_research: dict[str, Any]
    market_insights: dict[str, Any]
    competitors: str
    business_plan: str
    marketing: str
    revenue: str
    validation: dict[str, Any]
    report: dict[str, Any]
    location: dict[str, Any]
    history_id: int
    chroma_document_id: str | None
    storage_warning: str
    workflow: str


def idea_analysis_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    state["analysis"] = analyze_startup(state["idea"])
    return state


def competitor_research_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    market_research = search_market(state["idea"])
    state["market_research"] = market_research
    state["market_insights"] = process_market_data(market_research)
    state["competitors"] = get_competitors(state["idea"], market_research, location=state.get("location"))
    return state


def business_plan_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    state["business_plan"] = generate_business_plan(
        state["idea"],
        analysis=state.get("analysis"),
        market_insights=state.get("market_insights"),
        competitors=state.get("competitors"),
        location=state.get("location"),
    )
    return state


def marketing_strategy_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    state["marketing"] = generate_marketing_strategy(
        state["idea"],
        analysis=state.get("analysis"),
        market_insights=state.get("market_insights"),
        competitors=state.get("competitors"),
        location=state.get("location"),
    )
    return state


def revenue_estimation_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    state["revenue"] = generate_revenue_estimate(
        state["idea"],
        analysis=state.get("analysis"),
        market_insights=state.get("market_insights"),
        business_plan=state.get("business_plan"),
        location=state.get("location"),
    )
    return state


def startup_validator_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    state["validation"] = validate_startup_package(dict(state))
    return state


def report_builder_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    state["report"] = build_structured_report(dict(state))
    return state


def persistence_agent(state: StartupWorkflowState) -> StartupWorkflowState:
    state["report"] = build_structured_report(dict(state))
    history_id = save_startup(
        state["idea"],
        state["analysis"],
        state["competitors"],
        state["business_plan"],
        state["marketing"],
        state["revenue"],
        market_research=state.get("market_research"),
        market_insights=state.get("market_insights"),
        validation=state.get("validation"),
        report=state.get("report"),
    )
    state["history_id"] = history_id
    state["report"] = build_structured_report(dict(state))
    try:
        state["chroma_document_id"] = store_startup_package(
            state["idea"],
            dict(state),
            history_id,
        )
        state["report"] = build_structured_report(dict(state))
    except Exception:
        logger.exception("ChromaDB storage failed for startup history id %s", history_id)
        state["chroma_document_id"] = None
        state["storage_warning"] = (
            "Vector storage was unavailable; the package was saved to SQLite."
        )
        state["report"] = build_structured_report(dict(state))
    update_startup_report(history_id, state["report"])
    return state


def _build_langgraph_workflow():
    from langgraph.graph import END, StateGraph

    graph = StateGraph(StartupWorkflowState)
    graph.add_node("idea_analysis_agent", idea_analysis_agent)
    graph.add_node("competitor_research_agent", competitor_research_agent)
    graph.add_node("business_plan_agent", business_plan_agent)
    graph.add_node("marketing_strategy_agent", marketing_strategy_agent)
    graph.add_node("revenue_estimation_agent", revenue_estimation_agent)
    graph.add_node("startup_validator_agent", startup_validator_agent)
    graph.add_node("report_builder_agent", report_builder_agent)
    graph.add_node("persistence_agent", persistence_agent)

    graph.set_entry_point("idea_analysis_agent")
    graph.add_edge("idea_analysis_agent", "competitor_research_agent")
    graph.add_edge("competitor_research_agent", "business_plan_agent")
    graph.add_edge("business_plan_agent", "marketing_strategy_agent")
    graph.add_edge("marketing_strategy_agent", "revenue_estimation_agent")
    graph.add_edge("revenue_estimation_agent", "startup_validator_agent")
    graph.add_edge("startup_validator_agent", "report_builder_agent")
    graph.add_edge("report_builder_agent", "persistence_agent")
    graph.add_edge("persistence_agent", END)
    return graph.compile()


def _run_sequential_fallback(initial_state: StartupWorkflowState) -> StartupWorkflowState:
    state = idea_analysis_agent(initial_state)
    state = competitor_research_agent(state)
    state = business_plan_agent(state)
    state = marketing_strategy_agent(state)
    state = revenue_estimation_agent(state)
    state = startup_validator_agent(state)
    state = report_builder_agent(state)
    state = persistence_agent(state)
    state["workflow"] = "sequential-fallback"
    return state


def run_startup_workflow(idea: str) -> dict[str, Any]:
    """Run the complete Member 1 + Member 2 backend workflow."""
    initial_state: StartupWorkflowState = {"idea": idea}
    try:
        workflow = _build_langgraph_workflow()
        final_state = workflow.invoke(initial_state)
        final_state["workflow"] = "langgraph"
    except ModuleNotFoundError:
        logger.warning("LangGraph is not installed; using sequential fallback")
        final_state = _run_sequential_fallback(initial_state)
    return dict(final_state)
