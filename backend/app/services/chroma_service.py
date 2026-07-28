"""Persistent ChromaDB storage for generated startup reports."""

import json
import logging
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

import chromadb

logger = logging.getLogger(__name__)
_collection = None


def initialize_database():
    """Create and return the persistent collection used for startup documents."""
    global _collection
    if _collection is None:
        database_path = Path(os.getenv("CHROMA_PATH", "./chroma_data"))
        database_path.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(database_path))
        _collection = client.get_or_create_collection(name="startup_reports")
    return _collection


def store_document(document: str, metadata: dict[str, Any] | None = None, document_id: str | None = None) -> str:
    """Store one text document and return its stable Chroma document identifier."""
    identifier = document_id or str(uuid4())
    safe_metadata = {key: str(value) for key, value in (metadata or {}).items() if value is not None}
    initialize_database().upsert(ids=[identifier], documents=[document], metadatas=[safe_metadata])
    return identifier


def store_startup_package(startup_name: str, package: dict[str, Any], history_id: int) -> str:
    """Serialize and store a complete generated package for RAG retrieval."""
    return store_document(
        json.dumps(package, ensure_ascii=False, default=str),
        {"startup_name": startup_name, "history_id": history_id, "document_type": "startup_package"},
        document_id=f"startup-{history_id}",
    )


def search_documents(query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Retrieve documents semantically similar to a user query."""
    result = initialize_database().query(query_texts=[query], n_results=limit)
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    return [
        {"document": document, "metadata": metadata or {}, "distance": distance}
        for document, metadata, distance in zip(documents, metadatas, distances)
    ]
