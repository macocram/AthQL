from __future__ import annotations

import functools
import time
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.config import settings
from app.errors import log_aws_error


@functools.lru_cache(maxsize=1)
def get_boto3_session() -> boto3.Session:
    if settings.aws_profile:
        return boto3.Session(profile_name=settings.aws_profile, region_name=settings.aws_region)
    return boto3.Session(region_name=settings.aws_region)


@functools.lru_cache(maxsize=4)
def get_athena_client():
    return get_boto3_session().client("athena")


@functools.lru_cache(maxsize=4)
def get_glue_client():
    return get_boto3_session().client("glue")


@functools.lru_cache(maxsize=4)
def get_s3_client():
    return get_boto3_session().client("s3")


@functools.lru_cache(maxsize=1)
def get_account_id() -> str:
    return get_boto3_session().client("sts").get_caller_identity()["Account"]


class MetadataCache:
    def __init__(self, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.time() + self.ttl_seconds, value)

    def clear(self) -> None:
        self._store.clear()


metadata_cache = MetadataCache(settings.metadata_cache_ttl_seconds)


def resolve_catalog_id(catalog: str) -> str | None:
    """Map UI/catalog aliases to the Glue CatalogId used by the AWS API."""
    if catalog.lower() in {"awsdatacatalog", "default"}:
        return get_account_id()
    if catalog == get_account_id():
        return catalog
    return catalog


def resolve_athena_catalog(catalog: str | None) -> str | None:
    """Map stored catalog values to the name Athena expects in QueryExecutionContext."""
    if not catalog:
        return None
    if catalog.lower() in {"awsdatacatalog", "default"}:
        return "AwsDataCatalog"
    if catalog == get_account_id():
        return "AwsDataCatalog"
    return catalog


def get_workgroup_output_location() -> str | None:
    if settings.athena_output_location:
        return settings.athena_output_location

    try:
        response = get_athena_client().get_work_group(WorkGroup=settings.athena_workgroup)
        result_config = response["WorkGroup"]["Configuration"].get("ResultConfiguration", {})
        output_location = result_config.get("OutputLocation")
        if output_location:
            return output_location
    except ClientError as exc:
        log_aws_error(exc, context="resolve workgroup output location")

    # The Athena console often passes an output location per query without saving it on
    # the workgroup. Re-use the prefix from a recent successful query in this workgroup.
    return _discover_output_location_from_history()


def uses_managed_query_results() -> bool:
    try:
        response = get_athena_client().get_work_group(WorkGroup=settings.athena_workgroup)
        result_config = response["WorkGroup"]["Configuration"].get("ResultConfiguration", {})
        managed = result_config.get("ManagedQueryResultsConfiguration") or {}
        return bool(managed.get("Enabled"))
    except ClientError as exc:
        log_aws_error(exc, context="read managed query results setting")
        return False


def _discover_output_location_from_history() -> str | None:
    try:
        client = get_athena_client()
        execution_ids = client.list_query_executions(
            WorkGroup=settings.athena_workgroup,
            MaxResults=20,
        ).get("QueryExecutionIds", [])
        for execution_id in execution_ids:
            execution = client.get_query_execution(QueryExecutionId=execution_id)["QueryExecution"]
            if execution["Status"]["State"] != "SUCCEEDED":
                continue
            output_location = execution.get("ResultConfiguration", {}).get("OutputLocation")
            if not output_location:
                continue
            return _output_prefix(output_location)
    except ClientError as exc:
        log_aws_error(exc, context="discover output location from query history")
        return None
    return None


def _output_prefix(output_location: str) -> str:
    """Convert a result file URI into the S3 prefix Athena expects for new queries."""
    if output_location.endswith("/"):
        return output_location
    parsed = output_location.replace("s3://", "").split("/", 1)
    bucket = parsed[0]
    key = parsed[1] if len(parsed) > 1 else ""
    if not key:
        return f"s3://{bucket}/"
    prefix = key.rsplit("/", 1)[0]
    return f"s3://{bucket}/{prefix}/" if prefix else f"s3://{bucket}/"


def get_active_profile() -> dict[str, str | None]:
    session = get_boto3_session()
    credentials = session.get_credentials()
    frozen = credentials.get_frozen_credentials() if credentials else None
    output_location = get_workgroup_output_location()
    warnings: list[str] = []
    if not output_location:
        warnings.append(
            "No Athena query output location found. AthQL will try to infer it from recent "
            f"queries in workgroup '{settings.athena_workgroup}'. "
            "If queries fail, set ATHQL_ATHENA_OUTPUT_LOCATION in config/athql.env."
        )

    return {
        "profile": settings.aws_profile or session.profile_name or "default",
        "region": session.region_name or settings.aws_region,
        "access_key_hint": f"...{frozen.access_key[-4:]}" if frozen and frozen.access_key else None,
        "athena_workgroup": settings.athena_workgroup,
        "athena_output_location": output_location,
        "athena_ready": bool(output_location),
        "warnings": warnings,
    }


def list_catalogs() -> list[dict[str, str]]:
    cache_key = "catalogs"
    cached = metadata_cache.get(cache_key)
    if cached is not None:
        return cached

    client = get_glue_client()
    catalogs: list[dict[str, str]] = []
    try:
        response = client.get_catalogs()
        account_id = get_account_id()
        for catalog in response.get("CatalogList", []):
            catalog_id = str(catalog["CatalogId"])
            # Glue uses the account ID for the default catalog; Athena uses AwsDataCatalog.
            name = "AwsDataCatalog" if catalog_id == account_id else catalog_id
            catalogs.append(
                {
                    "name": name,
                    "type": catalog.get("Type", "GLUE"),
                }
            )
    except ClientError as exc:
        log_aws_error(exc, context="list Glue catalogs")

    if not catalogs:
        catalogs = [{"name": "AwsDataCatalog", "type": "GLUE"}]

    metadata_cache.set(cache_key, catalogs)
    return catalogs


def list_databases(catalog: str = "AwsDataCatalog") -> list[dict[str, str]]:
    cache_key = f"databases:{catalog}"
    cached = metadata_cache.get(cache_key)
    if cached is not None:
        return cached

    client = get_glue_client()
    databases: list[dict[str, str]] = []
    catalog_id = resolve_catalog_id(catalog)
    paginator = client.get_paginator("get_databases")
    for page in paginator.paginate(CatalogId=catalog_id):
        for db in page.get("DatabaseList", []):
            databases.append({"name": db["Name"], "description": db.get("Description") or ""})

    metadata_cache.set(cache_key, databases)
    return databases


def list_tables(catalog: str, database: str) -> list[dict[str, str]]:
    cache_key = f"tables:{catalog}:{database}"
    cached = metadata_cache.get(cache_key)
    if cached is not None:
        return cached

    client = get_glue_client()
    tables: list[dict[str, str]] = []
    catalog_id = resolve_catalog_id(catalog)
    paginator = client.get_paginator("get_tables")
    for page in paginator.paginate(CatalogId=catalog_id, DatabaseName=database):
        for table in page.get("TableList", []):
            tables.append(
                {
                    "name": table["Name"],
                    "type": table.get("TableType", "TABLE"),
                }
            )

    metadata_cache.set(cache_key, tables)
    return tables


def list_columns(catalog: str, database: str, table: str) -> list[dict[str, str]]:
    cache_key = f"columns:{catalog}:{database}:{table}"
    cached = metadata_cache.get(cache_key)
    if cached is not None:
        return cached

    client = get_glue_client()
    catalog_id = resolve_catalog_id(catalog)
    response = client.get_table(CatalogId=catalog_id, DatabaseName=database, Name=table)

    table_meta = response["Table"]
    columns: list[dict[str, str]] = []
    for col in table_meta.get("StorageDescriptor", {}).get("Columns", []):
        columns.append({"name": col["Name"], "type": col.get("Type", "string")})
    for col in table_meta.get("PartitionKeys", []):
        columns.append({"name": col["Name"], "type": col.get("Type", "string"), "partition": "true"})

    metadata_cache.set(cache_key, columns)
    return columns
