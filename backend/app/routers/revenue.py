"""Revenue-estimation API endpoint."""

import logging
from fastapi import APIRouter, HTTPException, status
from app.models.revenue import RevenueRequest
from app.services.revenue_service import generate_revenue_estimate

router = APIRouter(tags=["Revenue"])
logger = logging.getLogger(__name__)

@router.post("/revenue")
def revenue(request: RevenueRequest) -> dict[str, str]:
    """Generate an assumption-based revenue estimate for a startup idea."""
    try:
        return {"startup": request.idea, "revenue": generate_revenue_estimate(request.idea)}
    except Exception as exc:
        logger.exception("Revenue estimation failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Revenue estimation failed") from exc
