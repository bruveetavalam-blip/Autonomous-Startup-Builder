from fastapi import APIRouter

from app.models.competitor import CompetitorRequest
from app.services.competitor_service import get_competitors

router = APIRouter()

@router.post("/competitors")
def competitors(request: CompetitorRequest):

    result = get_competitors(request.idea)

    return {
        "startup": request.idea,
        "competitors": result
    }