"""Business-plan API endpoint."""

import logging
from fastapi import APIRouter, HTTPException, status
from app.models.business import BusinessPlanRequest
from app.services.business_service import generate_business_plan

router = APIRouter(tags=["Business"])
logger = logging.getLogger(__name__)

@router.post("/business-plan")
def business_plan(request: BusinessPlanRequest) -> dict[str, str]:
    """Generate a complete business plan for one startup idea."""
    try:
        return {"startup": request.idea, "business_plan": generate_business_plan(request.idea)}
    except Exception as exc:
        logger.exception("Business-plan generation failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Business-plan generation failed") from exc
