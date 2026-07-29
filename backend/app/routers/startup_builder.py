"""Combined autonomous startup-builder API endpoint."""

import logging
import re
from fastapi import APIRouter, HTTPException, status
from app.models.startup_builder import StartupBuilderRequest
from app.services.llm_service import LLMConfigurationError
from app.services.startup_builder_service import build_startup_package

router = APIRouter(tags=["Startup Builder"])
logger = logging.getLogger(__name__)

@router.post("/startup-builder")
def startup_builder(request: StartupBuilderRequest) -> dict:
    """Build and persist the complete startup package for an idea."""
    try:
        return build_startup_package(request.idea)
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
