from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import storage as storage_service

router = APIRouter(prefix="/settings", tags=["settings"])


class CleanupRequest(BaseModel):
    action: Literal[
        "history_older_than",
        "history_keep_last",
        "history_failed",
        "history_all",
        "vacuum",
    ]
    days: int | None = Field(default=None, ge=1, le=3650)
    keep: int | None = Field(default=None, ge=0, le=100_000)


@router.get("/storage")
def storage_stats():
    return storage_service.get_storage_stats()


@router.post("/storage/cleanup")
def storage_cleanup(body: CleanupRequest) -> dict[str, Any]:
    deleted = 0
    vacuum_result: dict[str, Any] | None = None
    message = ""

    try:
        if body.action == "history_older_than":
            if body.days is None:
                raise HTTPException(status_code=400, detail="days is required")
            deleted = storage_service.cleanup_history_older_than(body.days)
            message = f"Removed {deleted} history entries older than {body.days} days"
        elif body.action == "history_keep_last":
            if body.keep is None:
                raise HTTPException(status_code=400, detail="keep is required")
            deleted = storage_service.cleanup_history_keep_last(body.keep)
            message = f"Removed {deleted} history entries, kept the latest {body.keep}"
        elif body.action == "history_failed":
            deleted = storage_service.cleanup_failed_history()
            message = f"Removed {deleted} failed or cancelled history entries"
        elif body.action == "history_all":
            deleted = storage_service.cleanup_all_history()
            message = f"Removed all {deleted} history entries"
        elif body.action == "vacuum":
            vacuum_result = storage_service.vacuum_database()
            reclaimed = vacuum_result["reclaimed_bytes"]
            message = f"Database compacted — reclaimed {storage_service._human_size(reclaimed)}"
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result: dict[str, Any] = {
        "deleted": deleted,
        "message": message,
        "stats": storage_service.get_storage_stats(),
    }
    if vacuum_result:
        result["vacuum"] = vacuum_result
    return result
