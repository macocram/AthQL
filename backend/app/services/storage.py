from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta
from typing import Any

from app.config import settings
from app.database import get_connection


def _human_size(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    if num_bytes < 1024**2:
        return f"{num_bytes / 1024:.1f} KB"
    if num_bytes < 1024**3:
        return f"{num_bytes / 1024**2:.2f} MB"
    return f"{num_bytes / 1024**3:.2f} GB"


def get_storage_stats() -> dict[str, Any]:
    db_path = settings.db_path
    size_bytes = db_path.stat().st_size if db_path.exists() else 0

    with get_connection() as conn:
        history_count = conn.execute("SELECT COUNT(*) FROM query_history").fetchone()[0]
        saved_count = conn.execute("SELECT COUNT(*) FROM saved_queries").fetchone()[0]
        folder_count = conn.execute("SELECT COUNT(*) FROM folders").fetchone()[0]
        oldest = conn.execute("SELECT MIN(executed_at) FROM query_history").fetchone()[0]
        newest = conn.execute("SELECT MAX(executed_at) FROM query_history").fetchone()[0]
        failed_count = conn.execute(
            "SELECT COUNT(*) FROM query_history WHERE status IN ('FAILED', 'CANCELLED')"
        ).fetchone()[0]

    return {
        "db_path": str(db_path),
        "data_dir": str(settings.data_dir),
        "db_size_bytes": size_bytes,
        "db_size_human": _human_size(size_bytes),
        "counts": {
            "query_history": history_count,
            "saved_queries": saved_count,
            "folders": folder_count,
            "failed_history": failed_count,
        },
        "history_oldest": oldest,
        "history_newest": newest,
    }


def cleanup_history_older_than(days: int) -> int:
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM query_history WHERE executed_at < ?", (cutoff,))
        conn.commit()
        return cursor.rowcount


def cleanup_history_keep_last(keep: int) -> int:
    if keep < 0:
        raise ValueError("keep must be non-negative")
    with get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM query_history").fetchone()[0]
        if total <= keep:
            return 0
        cursor = conn.execute(
            """
            DELETE FROM query_history
            WHERE id NOT IN (
                SELECT id FROM query_history
                ORDER BY executed_at DESC
                LIMIT ?
            )
            """,
            (keep,),
        )
        conn.commit()
        return cursor.rowcount


def cleanup_failed_history() -> int:
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM query_history WHERE status IN ('FAILED', 'CANCELLED')"
        )
        conn.commit()
        return cursor.rowcount


def cleanup_all_history() -> int:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM query_history")
        conn.commit()
        return cursor.rowcount


def vacuum_database() -> dict[str, Any]:
    before = settings.db_path.stat().st_size if settings.db_path.exists() else 0
    conn = sqlite3.connect(settings.db_path)
    try:
        conn.execute("VACUUM")
        conn.commit()
    finally:
        conn.close()
    after = settings.db_path.stat().st_size if settings.db_path.exists() else 0
    return {
        "size_before_bytes": before,
        "size_after_bytes": after,
        "reclaimed_bytes": max(before - after, 0),
        "size_after_human": _human_size(after),
    }
