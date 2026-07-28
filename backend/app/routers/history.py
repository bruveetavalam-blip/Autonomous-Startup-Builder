"""Saved startup history API endpoints."""

from fastapi import APIRouter, HTTPException, status
from app.database.db import get_history, get_startup

router = APIRouter(tags=["History"])

@router.get("/history")
def history() -> list[dict]:
    """List saved startup packages, newest first."""
    return get_history()

@router.get("/history/{startup_id}")
def startup_history_item(startup_id: int) -> dict:
    """Fetch a complete saved startup package by identifier."""
    startup = get_startup(startup_id)
    if startup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup history item not found")
    return startup


@router.get("/reports/{startup_id}")
def startup_report(startup_id: int) -> dict:
    """Fetch the panel-friendly structured report for one startup."""
    startup = get_startup(startup_id)
    if startup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup report not found")
    return startup.get("report") or startup
