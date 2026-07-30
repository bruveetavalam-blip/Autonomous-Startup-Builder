"""SQLite persistence helpers for generated startup packages."""

import json
import os
import hashlib
import hmac
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DATABASE_PATH = Path(os.getenv("SQLITE_PATH", "./startup_builder.db"))


@contextmanager
def _connection() -> Iterator[sqlite3.Connection]:
    """Provide a committing SQLite connection with dictionary-style rows."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database() -> None:
    """Create application tables if they do not already exist."""
    with _connection() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS startup_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                startup_name TEXT NOT NULL,
                analysis TEXT NOT NULL,
                competitors TEXT NOT NULL,
                business_plan TEXT NOT NULL,
                marketing TEXT NOT NULL,
                revenue TEXT NOT NULL,
                market_research TEXT NOT NULL DEFAULT '{}',
                market_insights TEXT NOT NULL DEFAULT '{}',
                validation TEXT NOT NULL DEFAULT '{}',
                report TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                company TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL DEFAULT 'Founder',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(startup_history)").fetchall()
        }
        if "market_research" not in columns:
            connection.execute(
                "ALTER TABLE startup_history ADD COLUMN market_research TEXT NOT NULL DEFAULT '{}'"
            )
        if "market_insights" not in columns:
            connection.execute(
                "ALTER TABLE startup_history ADD COLUMN market_insights TEXT NOT NULL DEFAULT '{}'"
            )
        if "validation" not in columns:
            connection.execute(
                "ALTER TABLE startup_history ADD COLUMN validation TEXT NOT NULL DEFAULT '{}'"
            )
        if "report" not in columns:
            connection.execute(
                "ALTER TABLE startup_history ADD COLUMN report TEXT NOT NULL DEFAULT '{}'"
            )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS startup_jobs (
                job_id TEXT PRIMARY KEY,
                startup_id INTEGER NOT NULL,
                idea TEXT NOT NULL,
                location TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'running',
                agents TEXT NOT NULL DEFAULT '{}',
                outputs TEXT NOT NULL DEFAULT '{}',
                errors TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        job_columns = {row["name"] for row in connection.execute("PRAGMA table_info(startup_jobs)").fetchall()}
        if "location" not in job_columns:
            connection.execute("ALTER TABLE startup_jobs ADD COLUMN location TEXT NOT NULL DEFAULT '{}'")


def save_startup(
    startup_name: str,
    analysis: Any,
    competitors: Any,
    business_plan: Any,
    marketing: Any,
    revenue: Any,
    market_research: Any | None = None,
    market_insights: Any | None = None,
    validation: Any | None = None,
    report: Any | None = None,
) -> int:
    """Persist a generated package and return its history identifier."""
    initialize_database()
    values = tuple(
        json.dumps(value, ensure_ascii=False, default=str)
        for value in (
            analysis,
            competitors,
            business_plan,
            marketing,
            revenue,
            market_research or {},
            market_insights or {},
            validation or {},
            report or {},
        )
    )
    with _connection() as connection:
        cursor = connection.execute(
            """INSERT INTO startup_history
            (startup_name, analysis, competitors, business_plan, marketing, revenue, market_research, market_insights, validation, report)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (startup_name, *values),
        )
        return int(cursor.lastrowid)


def update_startup_report(startup_id: int, report: Any) -> None:
    """Update the structured report after workflow-generated IDs are known."""
    initialize_database()
    with _connection() as connection:
        connection.execute(
            "UPDATE startup_history SET report = ? WHERE id = ?",
            (json.dumps(report, ensure_ascii=False, default=str), startup_id),
        )


def update_startup_section(startup_id: int, section: str, value: Any) -> None:
    """Save one completed agent section without rewriting other sections."""
    columns = {
        "market_research": "market_research",
        "market_insights": "market_insights",
        "competitors": "competitors",
        "business_plan": "business_plan",
        "marketing": "marketing",
        "revenue": "revenue",
        "validation": "validation",
    }
    column = columns.get(section)
    if not column:
        return
    initialize_database()
    with _connection() as connection:
        connection.execute(
            f"UPDATE startup_history SET {column} = ? WHERE id = ?",
            (json.dumps(value, ensure_ascii=False, default=str), startup_id),
        )


def create_startup_job(idea: str, startup_id: int, location: Any | None = None) -> str:
    """Create a durable asynchronous workflow record."""
    job_id = uuid.uuid4().hex
    initialize_database()
    with _connection() as connection:
        connection.execute(
            "INSERT INTO startup_jobs (job_id, startup_id, idea, location) VALUES (?, ?, ?, ?)",
            (job_id, startup_id, idea, json.dumps(location or {}, ensure_ascii=False)),
        )
    return job_id


def update_startup_job(
    job_id: str,
    *,
    agents: Any,
    outputs: Any,
    errors: Any,
    status: str,
) -> None:
    """Persist the latest job snapshot after every agent event."""
    initialize_database()
    with _connection() as connection:
        connection.execute(
            """UPDATE startup_jobs
               SET agents = ?, outputs = ?, errors = ?, status = ?, updated_at = CURRENT_TIMESTAMP
               WHERE job_id = ?""",
            tuple(
                json.dumps(value, ensure_ascii=False, default=str)
                for value in (agents, outputs, errors)
            ) + (status, job_id),
        )


def get_startup_job(job_id: str) -> dict[str, Any] | None:
    """Return a persisted workflow snapshot."""
    initialize_database()
    with _connection() as connection:
        row = connection.execute("SELECT * FROM startup_jobs WHERE job_id = ?", (job_id,)).fetchone()
    if not row:
        return None
    record = dict(row)
    for field in ("agents", "outputs", "errors", "location"):
        record[field] = json.loads(record[field])
    return record


def _deserialize(row: sqlite3.Row) -> dict[str, Any]:
    """Convert serialized report columns into an API-friendly record."""
    record = dict(row)
    for field in (
        "analysis",
        "competitors",
        "business_plan",
        "marketing",
        "revenue",
        "market_research",
        "market_insights",
        "validation",
        "report",
    ):
        record[field] = json.loads(record[field])
    return record


def get_history() -> list[dict[str, Any]]:
    """Return saved startups, newest first, without large report payloads."""
    initialize_database()
    with _connection() as connection:
        rows = connection.execute("SELECT id, startup_name, created_at FROM startup_history ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]


def get_startup(startup_id: int) -> dict[str, Any] | None:
    """Return one full saved startup package, if it exists."""
    initialize_database()
    with _connection() as connection:
        row = connection.execute("SELECT * FROM startup_history WHERE id = ?", (startup_id,)).fetchone()
    return _deserialize(row) if row else None


def _hash_password(password: str) -> str:
    """Hash a password using PBKDF2 with a per-user random salt."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 240_000)
    return f"pbkdf2_sha256$240000${salt}${digest.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored PBKDF2 hash."""
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        )
        return hmac.compare_digest(digest.hex(), expected)
    except (ValueError, TypeError):
        return False


def create_user(full_name: str, email: str, password: str, company: str = "") -> dict[str, Any]:
    """Persist a signed-up user and return public profile data."""
    initialize_database()
    normalized_email = email.strip().lower()
    with _connection() as connection:
        cursor = connection.execute(
            """INSERT INTO users (full_name, email, password_hash, company)
            VALUES (?, ?, ?, ?)""",
            (full_name.strip(), normalized_email, _hash_password(password), company.strip()),
        )
        row = connection.execute(
            """SELECT id, full_name, email, company, role, created_at
            FROM users WHERE id = ?""",
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    """Return public profile data for a user by email."""
    initialize_database()
    with _connection() as connection:
        row = connection.execute(
            """SELECT id, full_name, email, company, role, created_at
            FROM users WHERE email = ?""",
            (email.strip().lower(),),
        ).fetchone()
    return dict(row) if row else None


def authenticate_user(email: str, password: str) -> dict[str, Any] | None:
    """Return public profile data when credentials are valid."""
    initialize_database()
    with _connection() as connection:
        row = connection.execute(
            """SELECT id, full_name, email, password_hash, company, role, created_at
            FROM users WHERE email = ?""",
            (email.strip().lower(),),
        ).fetchone()
    if row is None or not _verify_password(password, row["password_hash"]):
        return None
    profile = dict(row)
    profile.pop("password_hash", None)
    return profile
