import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.analyze import router as analyze_router
from app.routers.business import router as business_router
from app.routers.competitor import router as competitor_router
from app.routers.history import router as history_router
from app.routers.marketing import router as marketing_router
from app.routers.revenue import router as revenue_router
from app.routers.research import router as research_router
from app.routers.startup_builder import router as startup_builder_router
from app.database.db import initialize_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize durable SQLite storage when the API starts."""
    initialize_database()
    yield

app = FastAPI(
    title="Autonomous Startup Builder",
    version="1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
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
