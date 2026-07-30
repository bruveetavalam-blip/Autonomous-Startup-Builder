"""Durable, concurrent startup-agent orchestration.

The provider services are synchronous, so each independent agent runs in a
bounded worker thread. Every completion is persisted before the next event is
published to a polling client; one failure cannot cancel its siblings.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Callable

from app.database.db import (
    create_startup_job,
    get_startup_job,
    save_startup,
    update_startup_job,
    update_startup_report,
    update_startup_section,
)
from app.services.business_service import generate_business_plan
from app.services.competitor_service import get_competitors
from app.services.marketing_service import generate_marketing_strategy
from app.services.report_service import build_structured_report, validate_startup_package
from app.services.revenue_service import generate_revenue_estimate
from app.services.search_service import process_market_data, search_market

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=7, thread_name_prefix="startup-agent")
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()

AGENTS = {
    "market_research": {"label": "Market Research", "section": "market"},
    "competitors": {"label": "Competitor Analysis", "section": "competitors"},
    "business_plan": {"label": "Business Plan", "section": "business_plan"},
    "marketing": {"label": "Marketing Strategy", "section": "marketing_strategy"},
    "revenue": {"label": "Revenue Estimation", "section": "revenue_estimate"},
    "validation": {"label": "Validation", "section": "validation"},
    "source_collector": {"label": "Source Collector", "section": "sources"},
}


def _lock_for(job_id: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(job_id, threading.Lock())


def _source_collector(idea: str) -> list[dict[str, str]]:
    """Return stable, real references used for assumptions and discovery."""
    return [
        {"title": "Reserve Bank of India - Digital Payments", "url": "https://www.rbi.org.in/", "description": "Official Indian payments and financial-system reference.", "agent": "Source Collector", "group": "Official websites"},
        {"title": "Startup India", "url": "https://www.startupindia.gov.in/", "description": "Government startup ecosystem, funding, and compliance reference.", "agent": "Source Collector", "group": "Industry Reports"},
        {"title": "Google Trends", "url": "https://trends.google.com/", "description": "Demand and search-interest validation reference for the idea.", "agent": "Source Collector", "group": "Market Research"},
        {"title": "IBEF India Industry Reports", "url": "https://www.ibef.org/industry", "description": "India-focused sector and market context.", "agent": "Source Collector", "group": "Industry Reports"},
        {"title": "Similarweb", "url": "https://www.similarweb.com/", "description": "Traffic and competitor discovery reference.", "agent": "Source Collector", "group": "Competitor Research"},
    ]


def _location_text(location: dict[str, str]) -> str:
    return ", ".join(value for value in (location.get("city"), location.get("state"), location.get("country")) if value) or "India"


def _run_agent(name: str, idea: str, location: dict[str, str]) -> Any:
    context = _location_text(location)
    localized_idea = f"{idea}\n\nTarget launch location: {context}. Adapt every assumption to this location and use INR for Indian locations."
    if name == "market_research":
        raw = search_market(localized_idea)
        return {"research": raw, "insights": process_market_data(raw)}
    if name == "competitors":
        return get_competitors(idea, location=location)
    if name == "business_plan":
        return generate_business_plan(idea, location=location)
    if name == "marketing":
        return generate_marketing_strategy(idea, location=location)
    if name == "revenue":
        return generate_revenue_estimate(idea, location=location)
    if name == "validation":
        return validate_startup_package({"idea": idea, "location": location})
    if name == "source_collector":
        return _source_collector(idea)
    raise ValueError(f"Unknown agent: {name}")


def _initial_report(idea: str) -> dict[str, Any]:
    return build_structured_report({"idea": idea, "workflow": "parallel-agents", "agent_status": _agent_status()})


def _agent_status() -> dict[str, dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    return {name: {"label": data["label"], "status": "running", "progress": 0, "started_at": now} for name, data in AGENTS.items()}


def start_job(idea: str, location: dict[str, str] | None = None) -> dict[str, Any]:
    """Create a draft report and schedule all independent agents immediately."""
    location = location or {"country": "India", "state": "", "city": ""}
    startup_id = save_startup(idea, "", "", "", "", "", report=_initial_report(idea))
    job_id = create_startup_job(idea, startup_id, location)
    snapshot = {"agents": _agent_status(), "outputs": {}, "errors": {}, "status": "running"}
    update_startup_job(job_id, **snapshot)
    for name in AGENTS:
        _executor.submit(_execute_agent, job_id, startup_id, idea, location, name)
    return get_job_snapshot(job_id) or {"job_id": job_id, "startup_id": startup_id, **snapshot}


def _execute_agent(job_id: str, startup_id: int, idea: str, location: dict[str, str], name: str) -> None:
    try:
        output = _run_agent(name, idea, location)
        _record(job_id, startup_id, name, output, None)
    except Exception as exc:  # isolated failure by design
        logger.exception("Agent %s failed for job %s", name, job_id)
        _record(job_id, startup_id, name, None, str(exc))


def _record(job_id: str, startup_id: int, name: str, output: Any, error: str | None) -> None:
    with _lock_for(job_id):
        job = get_startup_job(job_id)
        if not job:
            return
        agents = job["agents"]
        outputs = job["outputs"]
        errors = job["errors"]
        outputs[name] = output
        if error:
            errors[name] = error
            agents[name].update({"status": "failed", "progress": 0, "error": error})
        else:
            agents[name].update({"status": "completed", "progress": 100, "completed_at": datetime.now(timezone.utc).isoformat()})
            _persist_output(startup_id, name, output)
        done = sum(item["status"] == "completed" for item in agents.values())
        failed = sum(item["status"] == "failed" for item in agents.values())
        status = "completed" if done + failed == len(agents) else "running"
        update_startup_job(job_id, agents=agents, outputs=outputs, errors=errors, status=status)
        report = build_structured_report({
            "idea": job["idea"], "location": job["location"], "workflow": "parallel-agents", "history_id": startup_id,
            **outputs, "agent_status": agents, "errors": errors,
        })
        update_startup_report(startup_id, report)


def _persist_output(startup_id: int, name: str, output: Any) -> None:
    if name == "market_research":
        update_startup_section(startup_id, "market_research", output.get("research", {}))
        update_startup_section(startup_id, "market_insights", output.get("insights", {}))
    elif name in {"competitors", "business_plan", "marketing", "revenue", "validation"}:
        update_startup_section(startup_id, name, output)


def retry_agent(job_id: str, name: str) -> dict[str, Any] | None:
    job = get_startup_job(job_id)
    if not job or name not in AGENTS:
        return None
    with _lock_for(job_id):
        job["agents"][name].update({"status": "running", "progress": 0})
        job["errors"].pop(name, None)
        update_startup_job(job_id, agents=job["agents"], outputs=job["outputs"], errors=job["errors"], status="running")
    _executor.submit(_execute_agent, job_id, job["startup_id"], job["idea"], job["location"], name)
    return get_job_snapshot(job_id)


def get_job_snapshot(job_id: str) -> dict[str, Any] | None:
    job = get_startup_job(job_id)
    if not job:
        return None
    report = build_structured_report({
        "idea": job["idea"], "location": job["location"], "workflow": "parallel-agents", "history_id": job["startup_id"],
        **job["outputs"], "agent_status": job["agents"], "errors": job["errors"],
    })
    return {"job_id": job["job_id"], "startup_id": job["startup_id"], "history_id": job["startup_id"], "idea": job["idea"], "status": job["status"], "agents": job["agents"], "errors": job["errors"], "report": report, "updated_at": job["updated_at"]}
