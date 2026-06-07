from fastapi import APIRouter

from app.services import metadata as metadata_service

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.get("/profile")
def active_profile():
    return metadata_service.get_active_profile()


@router.get("/catalogs")
def catalogs():
    return metadata_service.list_catalogs()


@router.get("/catalogs/{catalog}/databases")
def databases(catalog: str):
    return metadata_service.list_databases(catalog)


@router.get("/catalogs/{catalog}/databases/{database}/tables")
def tables(catalog: str, database: str):
    return metadata_service.list_tables(catalog, database)


@router.get("/catalogs/{catalog}/databases/{database}/tables/{table}/columns")
def columns(catalog: str, database: str, table: str):
    return metadata_service.list_columns(catalog, database, table)


@router.post("/refresh")
def refresh_metadata():
    metadata_service.metadata_cache.clear()
    return {"status": "ok"}
