"""Reusable retrieval-augmented generation helpers."""

import json
from typing import Any

from app.services.chroma_service import search_documents
from app.services.llm_service import generate_response
from app.database.db import get_history, get_startup
from app.services.chroma_service import store_startup_package


def retrieve_context(query: str, limit: int = 4) -> list[dict]:
    """Retrieve relevant startup reports from ChromaDB."""
    return search_documents(query, limit)


def answer_with_rag(query: str, limit: int = 4) -> str:
    """Answer a query using retrieved reports as the primary context."""
    matches = retrieve_context(query, limit)
    if not matches:
        return "No stored startup reports were found in the knowledge base yet."
    context = "\n\n".join(item["document"] for item in matches)
    prompt = f"""[STARTUP_KNOWLEDGE_ANSWER]
Answer the user's question using the startup-report context below.
If the context does not contain the answer, say so clearly.
Use clear Markdown headings and bullet points where helpful. Never return raw JSON.

Context:
{context}

Question: {query}
"""
    return format_structured_answer(generate_response(prompt))


def format_structured_answer(answer: str) -> str:
    """Convert accidental JSON model output into readable Markdown."""
    try:
        value = json.loads(answer)
    except (TypeError, json.JSONDecodeError):
        return answer
    return _markdown_value(value)


def _markdown_value(value: Any, heading_level: int = 2) -> str:
    if not isinstance(value, dict):
        return str(value)
    lines: list[str] = []
    for key, item in value.items():
        if key == "notes" and isinstance(item, str) and "offline model generated" in item.lower():
            continue
        title = str(key).replace("_", " ").title()
        if isinstance(item, dict):
            lines.append(f"{'#' * heading_level} {title}")
            for child_key, child_value in item.items():
                label = str(child_key).replace("_", " ").title()
                if isinstance(child_value, list):
                    lines.append(f"- **{label}:** " + "; ".join(_compact(entry) for entry in child_value))
                else:
                    lines.append(f"- **{label}:** {_compact(child_value)}")
        elif isinstance(item, list):
            lines.append(f"{'#' * heading_level} {title}")
            lines.extend(f"- {_compact(entry)}" for entry in item)
        else:
            lines.append(f"{'#' * heading_level} {title}\n{_compact(item)}")
    return "\n\n".join(lines)


def _compact(value: Any) -> str:
    if isinstance(value, dict):
        return "; ".join(f"{str(key).replace('_', ' ')}: {_compact(item)}" for key, item in value.items())
    if isinstance(value, list):
        return ", ".join(_compact(item) for item in value)
    return str(value)


def index_saved_reports() -> int:
    """Backfill the vector store from durable SQLite reports on API startup.

    This also repairs workspaces created before async workflow indexing was
    connected. Chroma upserts stable IDs, so running it on each startup is
    safe and keeps existing entries current.
    """
    indexed = 0
    for item in get_history():
        startup = get_startup(item["id"])
        if not startup:
            continue
        report = startup.get("report") or startup
        store_startup_package(item["startup_name"], {"report": report}, item["id"])
        indexed += 1
    return indexed
