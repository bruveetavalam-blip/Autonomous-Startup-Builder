"""Market data, RAG, and backend capability endpoints."""

from fastapi import APIRouter

from app.models.research import MarketResearchRequest, RAGQueryRequest
from app.services.chroma_service import search_documents
from app.services.llm_service import get_llm_status
from app.services.rag_service import answer_with_rag, retrieve_context
from app.services.search_service import process_market_data, search_market

router = APIRouter(tags=["Research"])


@router.get("/health")
def health() -> dict:
    """Report backend capability status."""
    return {
        "api": "ok",
        "llm": get_llm_status(),
        "features": {
            "fastapi_backend": True,
            "web_search": True,
            "market_data_processing": True,
            "chromadb_knowledge_base": True,
            "rag_pipeline": True,
            "langgraph_multi_agent_workflow": True,
            "llm_provider_fallback": True,
            "structured_startup_report": True,
            "startup_validator_agent": True,
            "source_citations": True,
            "report_retrieval_api": True,
        },
    }


@router.post("/market-research")
def market_research(request: MarketResearchRequest) -> dict:
    """Collect and process startup market data from web search."""
    raw = search_market(request.query)
    return {
        "query": request.query,
        "raw": raw,
        "processed": process_market_data(raw),
    }


@router.post("/rag/query")
def rag_query(request: RAGQueryRequest) -> dict:
    """Answer a question using stored startup reports."""
    return {
        "query": request.query,
        "answer": answer_with_rag(request.query, request.limit),
        "context": retrieve_context(request.query, request.limit),
    }


@router.get("/knowledge-base/search")
def knowledge_base_search(query: str, limit: int = 5) -> dict:
    """Search the ChromaDB startup-report knowledge base."""
    return {"query": query, "matches": search_documents(query, limit)}
