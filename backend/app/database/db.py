"""SQLite persistence helpers for generated startup packages."""

import json
import os
import sqlite3
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
    """Create the history table if it does not already exist."""
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
