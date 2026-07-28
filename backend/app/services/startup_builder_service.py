"""Startup analysis helpers and backward-compatible workflow entrypoint."""

from typing import Any
from app.services.llm_service import generate_response

def analyze_startup(idea: str) -> str:
    """Create the core startup analysis reused by the full workflow."""
    prompt = f"Analyze this startup idea: {idea}. Provide a one-line summary, target customers, business category, value proposition, and key risks. Keep it concise and actionable."
    return generate_response(prompt)

def build_startup_package(idea: str) -> dict[str, Any]:
    """Generate, persist, and return all reports for a startup idea."""
    from app.services.agent_workflow import run_startup_workflow

    return run_startup_workflow(idea)
