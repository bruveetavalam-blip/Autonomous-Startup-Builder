import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.analyze import router as analyze_router
from app.routers.auth import router as auth_router
from app.routers.business import router as business_router
from app.routers.competitor import router as competitor_router
from app.routers.history import router as history_router
from app.routers.marketing import router as marketing_router
from app.routers.revenue import router as revenue_router
from app.routers.research import router as research_router
from app.routers.startup_builder import router as startup_builder_router
from app.database.db import initialize_database
from app.database.mongo_store import initialize_mongodb
from app.services.rag_service import index_saved_reports

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize durable SQLite storage when the API starts."""
    initialize_database()
    initialize_mongodb()
    try:
        index_saved_reports()
    except Exception:
        logging.getLogger(__name__).exception("Knowledge-base backfill failed during startup")
    yield

app = FastAPI(
    title="Autonomous Startup Builder",
    version="1.0",
    lifespan=lifespan,
)

configured_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://[::1]:5173",
    "http://[::1]:5174",
    "http://[::1]:5175",
    "https://autonomous-startup-builder-1.onrender.com",
    *configured_origins,
],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|\[::1\]):517\d$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(auth_router)
app.include_router(competitor_router)
app.include_router(business_router)
app.include_router(marketing_router)
app.include_router(revenue_router)
app.include_router(history_router)
app.include_router(startup_builder_router)
app.include_router(research_router)

@app.get("/")
def home():
    return {
        "message": "Backend is running successfully!"
    }
