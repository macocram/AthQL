from fastapi import APIRouter, HTTPException

from app.services import metadata as metadata_service

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.get("/profile")
def active_profile():
    return metadata_service.get_active_profile()


@router.get("/catalogs")
def catalogs():
    try:
        return metadata_service.list_catalogs()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/catalogs/{catalog}/databases")
def databases(catalog: str):
    try:
        return metadata_service.list_databases(catalog)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/catalogs/{catalog}/databases/{database}/tables")
def tables(catalog: str, database: str):
    try:
        return metadata_service.list_tables(catalog, database)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/catalogs/{catalog}/databases/{database}/tables/{table}/columns")
def columns(catalog: str, database: str, table: str):
    try:
        return metadata_service.list_columns(catalog, database, table)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/refresh")
def refresh_metadata():
    metadata_service.metadata_cache.clear()
    return {"status": "ok"}
