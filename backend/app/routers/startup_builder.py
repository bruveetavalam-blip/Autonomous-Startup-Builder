"""Combined autonomous startup-builder API endpoint."""

import logging
from fastapi import APIRouter, HTTPException, status
from app.models.startup_builder import StartupBuilderRequest
from app.services.startup_builder_service import build_startup_package

router = APIRouter(tags=["Startup Builder"])
logger = logging.getLogger(__name__)

@router.post("/startup-builder")
def startup_builder(request: StartupBuilderRequest) -> dict:
    """Build and persist the complete startup package for an idea."""
    try:
        return build_startup_package(request.idea)
    except Exception as exc:
        logger.exception("Startup-builder workflow failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Startup-builder workflow failed") from exc
