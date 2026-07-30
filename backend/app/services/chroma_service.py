"""Persistent ChromaDB storage for generated startup reports."""

import json
import logging
import os
import hashlib
from pathlib import Path
from typing import Any
from uuid import uuid4

import chromadb

logger = logging.getLogger(__name__)
_collection = None


class LocalHashEmbeddingFunction:
    """Small local embedding function that avoids model downloads in restricted envs."""

    dimension = 384

    @staticmethod
    def name() -> str:
        return "local_hash_embedding"

    def __call__(self, input: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for text in input:
            vector = [0.0] * self.dimension
            tokens = str(text).lower().split()
            for token in tokens:
                digest = hashlib.sha256(token.encode("utf-8")).digest()
                index = int.from_bytes(digest[:4], "big") % self.dimension
                vector[index] += 1.0
            norm = sum(value * value for value in vector) ** 0.5 or 1.0
            embeddings.append([value / norm for value in vector])
        return embeddings

    # Chroma 1.x uses the explicit embedding protocol, while older releases
    # call the embedding function directly. Supporting both keeps the local,
    # no-download embedding implementation compatible across installations.
    def embed_documents(self, input: list[str]) -> list[list[float]]:
        return self(input)

    def embed_query(self, input: list[str]) -> list[list[float]]:
        return self(input)


def initialize_database():
    """Create and return the persistent collection used for startup documents."""
    global _collection
    if _collection is None:
        database_path = Path(os.getenv("CHROMA_PATH", "./chroma_data"))
        database_path.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(database_path))
        _collection = client.get_or_create_collection(
            name="startup_reports",
            embedding_function=LocalHashEmbeddingFunction(),
        )
    return _collection


def store_document(document: str, metadata: dict[str, Any] | None = None, document_id: str | None = None) -> str:
    """Store one text document and return its stable Chroma document identifier."""
    identifier = document_id or str(uuid4())
    safe_metadata = {key: str(value) for key, value in (metadata or {}).items() if value is not None}
    initialize_database().upsert(ids=[identifier], documents=[document], metadatas=[safe_metadata])
    return identifier


def store_startup_package(startup_name: str, package: dict[str, Any], history_id: int, owner_user_id: int | None = None) -> str:
    """Serialize and store a complete generated package for RAG retrieval."""
    # A readable document gives both the vector search and the answering model
    # useful section names, while metadata keeps the source report traceable.
    document = format_startup_package(startup_name, package)
    return store_document(
        document,
        {"startup_name": startup_name, "history_id": history_id, "owner_user_id": owner_user_id, "document_type": "startup_package"},
        document_id=f"startup-{history_id}",
    )


def format_startup_package(startup_name: str, package: dict[str, Any]) -> str:
    """Turn a report package into a compact, retrieval-friendly document."""
    report = package.get("report") if isinstance(package.get("report"), dict) else package
    sections = [
        ("Startup", startup_name or report.get("startup") or package.get("idea")),
        ("Idea analysis", report.get("analysis") or package.get("analysis")),
        ("Market research", report.get("market") or package.get("market_insights")),
        ("Competitor analysis", report.get("competitors") or package.get("competitors")),
        ("Business plan", report.get("business_plan") or package.get("business_plan")),
        ("Marketing strategy", report.get("marketing_strategy") or package.get("marketing")),
        ("Revenue estimate", report.get("revenue_estimate") or package.get("revenue")),
        ("Validation", report.get("validation") or package.get("validation")),
        ("Sources", report.get("sources") or package.get("source_collector")),
    ]
    rendered = [f"Startup report: {startup_name}"]
    for title, value in sections:
        if value in (None, "", {}, []):
            continue
        text = value if isinstance(value, str) else json.dumps(_without_internal_notes(value), ensure_ascii=False, default=str)
        rendered.append(f"\n## {title}\n{text}")
    return "\n".join(rendered)


def _without_internal_notes(value: Any) -> Any:
    """Keep provider/runtime messages out of user-facing report retrieval."""
    if isinstance(value, list):
        return [_without_internal_notes(item) for item in value]
    if isinstance(value, dict):
        return {
            key: _without_internal_notes(item)
            for key, item in value.items()
            if not (key == "notes" and isinstance(item, str) and "offline model generated" in item.lower())
        }
    return value


def search_documents(query: str, limit: int = 5, owner_user_id: int | None = None) -> list[dict[str, Any]]:
    """Retrieve documents semantically similar to a user query."""
    options: dict[str, Any] = {"query_texts": [query], "n_results": limit}
    if owner_user_id is not None:
        options["where"] = {"owner_user_id": str(owner_user_id)}
    result = initialize_database().query(**options)
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    return [
        {"document": document, "metadata": metadata or {}, "distance": distance}
        for document, metadata, distance in zip(documents, metadatas, distances)
    ]
