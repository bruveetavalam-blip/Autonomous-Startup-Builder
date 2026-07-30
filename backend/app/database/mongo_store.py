"""MongoDB persistence for account-owned startup workspace data."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection

logger = logging.getLogger(__name__)
_client: MongoClient | None = None
_database = None


def initialize_mongodb() -> None:
    """Connect to local MongoDB and create indexes used by the workspace."""
    global _client, _database
    if _database is not None:
        return
    uri = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
    name = os.getenv("MONGODB_DATABASE", "autonomous_startup_builder")
    _client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    _client.admin.command("ping")
    _database = _client[name]
    _database.users.create_index([("id", ASCENDING)], unique=True)
    _database.users.create_index([("email", ASCENDING)], unique=True)
    _database.startups.create_index([("id", ASCENDING)], unique=True)
    _database.startups.create_index([("owner_user_id", ASCENDING), ("created_at", DESCENDING)])
    _database.startup_jobs.create_index([("job_id", ASCENDING)], unique=True)
    _database.startup_jobs.create_index([("owner_user_id", ASCENDING), ("updated_at", DESCENDING)])
    logger.info("MongoDB persistence ready: %s", name)


def _collection(name: str) -> Collection:
    initialize_mongodb()
    return _database[name]


def _without_mongo_id(record: dict[str, Any] | None) -> dict[str, Any] | None:
    if record is None:
        return None
    result = dict(record)
    result.pop("_id", None)
    return result


def sync_user(user: dict[str, Any]) -> None:
    """Store the public account profile without duplicating password secrets."""
    record = {key: value for key, value in user.items() if key != "password_hash"}
    _collection("users").update_one({"id": record["id"]}, {"$set": record}, upsert=True)


def sync_startup(record: dict[str, Any], owner_user_id: int) -> None:
    """Persist the entire generated package under one account-owned document."""
    document = dict(record)
    document["owner_user_id"] = owner_user_id
    document["updated_at"] = datetime.now(timezone.utc).isoformat()
    _collection("startups").update_one({"id": document["id"]}, {"$set": document}, upsert=True)


def sync_job(record: dict[str, Any], owner_user_id: int) -> None:
    """Persist durable workflow state, every agent output, and any errors."""
    document = dict(record)
    document["owner_user_id"] = owner_user_id
    document["updated_at"] = datetime.now(timezone.utc).isoformat()
    _collection("startup_jobs").update_one({"job_id": document["job_id"]}, {"$set": document}, upsert=True)


def get_history(owner_user_id: int) -> list[dict[str, Any]]:
    return [_without_mongo_id(item) for item in _collection("startups").find(
        {"owner_user_id": owner_user_id}, {"id": 1, "startup_name": 1, "created_at": 1}
    ).sort("id", DESCENDING)]


def get_startup(startup_id: int, owner_user_id: int) -> dict[str, Any] | None:
    return _without_mongo_id(_collection("startups").find_one({"id": startup_id, "owner_user_id": owner_user_id}))


def get_job(job_id: str, owner_user_id: int) -> dict[str, Any] | None:
    return _without_mongo_id(_collection("startup_jobs").find_one({"job_id": job_id, "owner_user_id": owner_user_id}))
