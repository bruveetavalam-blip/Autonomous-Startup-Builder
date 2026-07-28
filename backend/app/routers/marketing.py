"""Marketing strategy API endpoint."""

import logging
from fastapi import APIRouter, HTTPException, status
from app.models.marketing import MarketingRequest
from app.services.marketing_service import generate_marketing_strategy

router = APIRouter(tags=["Marketing"])
logger = logging.getLogger(__name__)

@router.post("/marketing")
def marketing(request: MarketingRequest) -> dict[str, str]:
    """Generate a marketing strategy for one startup idea."""
    try:
        return {"startup": request.idea, "marketing": generate_marketing_strategy(request.idea)}
    except Exception as exc:
        logger.exception("Marketing generation failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Marketing generation failed") from exc
