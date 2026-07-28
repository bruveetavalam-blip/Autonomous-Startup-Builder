"""Reusable retrieval-augmented generation helpers."""

from app.services.chroma_service import search_documents
from app.services.llm_service import generate_response


def retrieve_context(query: str, limit: int = 4) -> list[dict]:
    """Retrieve relevant startup reports from ChromaDB."""
    return search_documents(query, limit)


def answer_with_rag(query: str, limit: int = 4) -> str:
    """Answer a query using retrieved reports as the primary context."""
    matches = retrieve_context(query, limit)
    if not matches:
        return "No stored startup reports were found in the knowledge base yet."
    context = "\n\n".join(item["document"] for item in matches)
    prompt = f"""Answer the user's question using the startup-report context below.
If the context does not contain the answer, say so clearly.

Context:
{context}

Question: {query}
"""
    return generate_response(prompt)
