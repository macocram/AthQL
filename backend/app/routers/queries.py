from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import get_connection, parse_tags, serialize_tags
from app.services import athena as athena_service
from app.services import sql as sql_service

router = APIRouter(prefix="/queries", tags=["queries"])


class ExecuteRequest(BaseModel):
    sql: str = Field(min_length=1)
    database: str | None = None
    catalog: str | None = None
    saved_query_id: str | None = None


class ExecuteResponse(BaseModel):
    execution_id: str


class FormatRequest(BaseModel):
    sql: str


class FormatResponse(BaseModel):
    sql: str


class HistoryEntry(BaseModel):
    id: str
    sql_text: str
    status: str
    data_scanned_bytes: int | None
    execution_time_ms: int | None
    error_message: str | None
    output_location: str | None = None
    executed_at: str


class SavedQuery(BaseModel):
    id: str
    folder_id: str | None
    name: str
    sql_text: str
    database_context: str | None
    catalog_context: str | None
    tags: list[str] = []
    last_execution_id: str | None = None
    last_output_location: str | None = None
    last_data_scanned_bytes: int | None = None
    last_execution_time_ms: int | None = None
    last_result_at: str | None = None
    updated_at: str


class SavedQueryCreate(BaseModel):
    name: str
    sql_text: str
    folder_id: str | None = None
    folder_name: str | None = None
    database_context: str | None = None
    catalog_context: str | None = None
    tags: list[str] = []


class SavedQueryUpdate(BaseModel):
    name: str | None = None
    sql_text: str | None = None
    folder_id: str | None = None
    folder_name: str | None = None
    database_context: str | None = None
    catalog_context: str | None = None
    tags: list[str] | None = None


class Folder(BaseModel):
    id: str
    name: str
    parent_id: str | None
    sort_order: int = 0
    created_at: str


class FolderCreate(BaseModel):
    name: str
    parent_id: str | None = None


class ReorderFoldersRequest(BaseModel):
    folder_ids: list[str]


def _row_to_saved_query(row: sqlite3.Row) -> SavedQuery:
    data = dict(row)
    data["tags"] = parse_tags(data.pop("tags", None))
    return SavedQuery(**data)


def _history_output_location(conn: sqlite3.Connection, execution_id: str) -> str | None:
    row = conn.execute(
        "SELECT output_location FROM query_history WHERE id = ?",
        (execution_id,),
    ).fetchone()
    return row["output_location"] if row else None


def _update_saved_query_last_result(
    conn: sqlite3.Connection,
    *,
    saved_query_id: str,
    execution_id: str,
    output_location: str,
    data_scanned_bytes: int | None,
    execution_time_ms: int | None,
) -> None:
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        UPDATE saved_queries
        SET last_execution_id = ?, last_output_location = ?, last_data_scanned_bytes = ?,
            last_execution_time_ms = ?, last_result_at = ?
        WHERE id = ?
        """,
        (
            execution_id,
            output_location,
            data_scanned_bytes,
            execution_time_ms,
            now,
            saved_query_id,
        ),
    )


def _resolve_folder_id(conn, folder_id: str | None, folder_name: str | None) -> str | None:
    if folder_id:
        return folder_id
    if not folder_name or not folder_name.strip():
        return None
    name = folder_name.strip()
    existing = conn.execute(
        "SELECT id FROM folders WHERE lower(name) = lower(?) AND parent_id IS NULL",
        (name,),
    ).fetchone()
    if existing:
        return existing["id"]
    folder_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, NULL, ?)",
        (folder_id, name, now),
    )
    return folder_id


@router.post("/execute", response_model=ExecuteResponse)
def execute_query(body: ExecuteRequest):
    execution_id = athena_service.start_query(body.sql, body.database, body.catalog)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO query_history (id, sql_text, status, saved_query_id)
            VALUES (?, ?, 'QUEUED', ?)
            """,
            (execution_id, body.sql, body.saved_query_id),
        )
        conn.commit()

    return ExecuteResponse(execution_id=execution_id)


@router.post("/format", response_model=FormatResponse)
def format_query(body: FormatRequest):
    try:
        formatted = sql_service.format_sql(body.sql)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FormatResponse(sql=formatted)


@router.get("/history", response_model=list[HistoryEntry])
def list_history(limit: int = 50):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, sql_text, status, data_scanned_bytes, execution_time_ms, error_message, output_location, executed_at
            FROM query_history
            ORDER BY executed_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        HistoryEntry(
            id=row["id"],
            sql_text=row["sql_text"],
            status=row["status"],
            data_scanned_bytes=row["data_scanned_bytes"],
            execution_time_ms=row["execution_time_ms"],
            error_message=row["error_message"],
            output_location=row["output_location"],
            executed_at=row["executed_at"],
        )
        for row in rows
    ]


@router.get("/saved", response_model=list[SavedQuery])
def list_saved_queries(tag: str | None = None, q: str | None = None):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, folder_id, name, sql_text, database_context, catalog_context, tags,
                   last_execution_id, last_output_location, last_data_scanned_bytes,
                   last_execution_time_ms, last_result_at, updated_at
            FROM saved_queries
            ORDER BY updated_at DESC
            """
        ).fetchall()

    queries = [_row_to_saved_query(row) for row in rows]
    if tag:
        needle = tag.lower()
        queries = [item for item in queries if any(t.lower() == needle for t in item.tags)]
    if q:
        needle = q.lower()
        queries = [
            item
            for item in queries
            if needle in item.name.lower()
            or needle in item.sql_text.lower()
            or any(needle in t.lower() for t in item.tags)
        ]
    return queries


@router.get("/saved/tags", response_model=list[str])
def list_saved_query_tags():
    with get_connection() as conn:
        rows = conn.execute("SELECT tags FROM saved_queries").fetchall()
    tags: set[str] = set()
    for row in rows:
        tags.update(parse_tags(row["tags"]))
    return sorted(tags)


@router.post("/saved", response_model=SavedQuery)
def create_saved_query(body: SavedQueryCreate):
    query_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    tags_json = serialize_tags(body.tags)
    with get_connection() as conn:
        folder_id = _resolve_folder_id(conn, body.folder_id, body.folder_name)
        conn.execute(
            """
            INSERT INTO saved_queries (id, folder_id, name, sql_text, database_context, catalog_context, tags, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                query_id,
                folder_id,
                body.name,
                body.sql_text,
                body.database_context,
                body.catalog_context,
                tags_json,
                now,
            ),
        )
        conn.commit()

    return SavedQuery(
        id=query_id,
        folder_id=folder_id,
        name=body.name,
        sql_text=body.sql_text,
        database_context=body.database_context,
        catalog_context=body.catalog_context,
        tags=body.tags,
        updated_at=now,
    )


@router.delete("/saved/{query_id}")
def delete_saved_query(query_id: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM saved_queries WHERE id = ?", (query_id,))
        conn.commit()
    return {"deleted": query_id}


@router.put("/saved/{query_id}", response_model=SavedQuery)
def update_saved_query(query_id: str, body: SavedQueryUpdate):
    with get_connection() as conn:
        existing = conn.execute(
            """
            SELECT id, folder_id, name, sql_text, database_context, catalog_context, tags,
                   last_execution_id, last_output_location, last_data_scanned_bytes,
                   last_execution_time_ms, last_result_at, updated_at
            FROM saved_queries WHERE id = ?
            """,
            (query_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Saved query not found")

        now = datetime.utcnow().isoformat()
        folder_id = existing["folder_id"]
        if body.folder_id is not None or body.folder_name:
            folder_id = _resolve_folder_id(conn, body.folder_id, body.folder_name)

        updated = {
            "name": body.name if body.name is not None else existing["name"],
            "sql_text": body.sql_text if body.sql_text is not None else existing["sql_text"],
            "folder_id": folder_id,
            "database_context": body.database_context if body.database_context is not None else existing["database_context"],
            "catalog_context": body.catalog_context if body.catalog_context is not None else existing["catalog_context"],
            "tags": serialize_tags(body.tags) if body.tags is not None else existing["tags"],
        }
        conn.execute(
            """
            UPDATE saved_queries
            SET name = ?, sql_text = ?, folder_id = ?, database_context = ?, catalog_context = ?, tags = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                updated["name"],
                updated["sql_text"],
                updated["folder_id"],
                updated["database_context"],
                updated["catalog_context"],
                updated["tags"],
                now,
                query_id,
            ),
        )
        conn.commit()

    return SavedQuery(
        id=query_id,
        updated_at=now,
        tags=parse_tags(updated["tags"]),
        **{k: v for k, v in updated.items() if k != "tags"},
    )


@router.get("/folders", response_model=list[Folder])
def list_folders():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, parent_id, sort_order, created_at FROM folders ORDER BY sort_order, name"
        ).fetchall()
    return [Folder(**dict(row)) for row in rows]


@router.post("/folders", response_model=Folder)
def create_folder(body: FolderCreate):
    folder_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        max_order = conn.execute("SELECT max(sort_order) FROM folders").fetchone()[0]
        next_order = (max_order or 0) + 1
        conn.execute(
            "INSERT INTO folders (id, name, parent_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
            (folder_id, body.name, body.parent_id, next_order, now),
        )
        conn.commit()
    return Folder(id=folder_id, name=body.name, parent_id=body.parent_id, sort_order=next_order, created_at=now)


@router.post("/folders/reorder")
def reorder_folders(body: ReorderFoldersRequest):
    with get_connection() as conn:
        for index, folder_id in enumerate(body.folder_ids):
            conn.execute(
                "UPDATE folders SET sort_order = ? WHERE id = ?",
                (index, folder_id),
            )
        conn.commit()
    return {"status": "ok"}


@router.get("/results/by-output-location")
def results_by_output_location(location: str, limit: int = 200):
    if not location.startswith("s3://"):
        raise HTTPException(status_code=400, detail="location must be an s3:// URI")
    try:
        return athena_service.fetch_preview_from_output_location(location, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/download-url/by-output-location")
def download_url_by_output_location(location: str):
    if not location.startswith("s3://"):
        raise HTTPException(status_code=400, detail="location must be an s3:// URI")
    try:
        url = athena_service.generate_download_url_for_output_location(location)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"url": url}


@router.get("/{execution_id}/status")
def query_status(execution_id: str):
    status = athena_service.get_query_status(execution_id)
    output_location = status.get("output_location")

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE query_history
            SET status = ?, data_scanned_bytes = ?, execution_time_ms = ?, error_message = ?,
                output_location = COALESCE(?, output_location)
            WHERE id = ?
            """,
            (
                status["status"],
                status.get("data_scanned_bytes"),
                status.get("execution_time_ms"),
                status.get("error_message"),
                output_location,
                execution_id,
            ),
        )
        if status["status"] == "SUCCEEDED" and output_location:
            row = conn.execute(
                "SELECT saved_query_id FROM query_history WHERE id = ?",
                (execution_id,),
            ).fetchone()
            if row and row["saved_query_id"]:
                _update_saved_query_last_result(
                    conn,
                    saved_query_id=row["saved_query_id"],
                    execution_id=execution_id,
                    output_location=output_location,
                    data_scanned_bytes=status.get("data_scanned_bytes"),
                    execution_time_ms=status.get("execution_time_ms"),
                )
        conn.commit()

    return status


@router.get("/{execution_id}/results")
def query_results(execution_id: str, limit: int = 200):
    with get_connection() as conn:
        stored = conn.execute(
            "SELECT status, output_location FROM query_history WHERE id = ?",
            (execution_id,),
        ).fetchone()

    try:
        status = athena_service.get_query_status(execution_id)
        if status["status"] != "SUCCEEDED":
            raise HTTPException(status_code=400, detail=f"Query not ready: {status['status']}")
        return athena_service.fetch_preview_rows(execution_id, limit=limit)
    except HTTPException:
        raise
    except Exception:
        if stored and stored["status"] == "SUCCEEDED" and stored["output_location"]:
            return athena_service.fetch_preview_from_output_location(stored["output_location"], limit=limit)
        raise HTTPException(status_code=400, detail="Results unavailable for this query")


@router.get("/{execution_id}/download-url")
def download_url(execution_id: str):
    with get_connection() as conn:
        stored_location = _history_output_location(conn, execution_id)

    try:
        url = athena_service.generate_download_url(execution_id)
    except Exception:
        if stored_location:
            url = athena_service.generate_download_url_for_output_location(stored_location)
        else:
            raise HTTPException(status_code=400, detail="Download unavailable for this query") from None
    return {"url": url}


@router.post("/{execution_id}/cancel")
def cancel_query(execution_id: str):
    athena_service.cancel_query(execution_id)
    return {"status": "CANCELLED"}

