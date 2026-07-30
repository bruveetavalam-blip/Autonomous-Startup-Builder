"""Combined autonomous startup-builder API endpoint."""

import logging
import re
from fastapi import APIRouter, HTTPException, status
from app.models.startup_builder import StartupBuilderRequest
from app.services.llm_service import LLMConfigurationError
from app.services.async_workflow import AGENTS, get_job_snapshot, retry_agent, start_job

router = APIRouter(tags=["Startup Builder"])
logger = logging.getLogger(__name__)

@router.post("/startup-builder", status_code=status.HTTP_202_ACCEPTED)
def startup_builder(request: StartupBuilderRequest) -> dict:
    """Queue all independent agents and return before the first LLM finishes."""
    try:
        return start_job(request.idea, {"country": request.country, "state": request.state, "city": request.city})
    except LLMConfigurationError as exc:
        logger.warning("Startup-builder LLM request failed: %s", exc)
        message = str(exc)
        if "rate_limit" in message.lower() or "rate limit" in message.lower():
            wait = re.search(r"try again in ([^.]+)", message, flags=re.IGNORECASE)
            detail = "Groq's token limit has been reached. Please try again after the quota resets."
            if wait:
                detail = f"Groq's token limit has been reached. Please try again in {wait.group(1).strip()}."
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The configured AI provider is unavailable. Check its API key and connection, then try again.",
        ) from exc
    except Exception as exc:
        logger.exception("Startup-builder workflow failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Startup-builder workflow failed") from exc


@router.get("/startup-builder/{job_id}")
def startup_builder_status(job_id: str) -> dict:
    """Return the current incremental report and agent states."""
    snapshot = get_job_snapshot(job_id)
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup job not found")
    return snapshot


@router.post("/startup-builder/{job_id}/agents/{agent_name}/retry")
def retry_startup_agent(job_id: str, agent_name: str) -> dict:
    """Retry exactly one failed agent while preserving all completed work."""
    if agent_name not in AGENTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown agent")
    snapshot = retry_agent(job_id, agent_name)
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup job not found")
    return snapshot
