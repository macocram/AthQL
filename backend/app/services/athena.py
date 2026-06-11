from __future__ import annotations

import csv
import io
from typing import Any
from urllib.parse import urlparse

from app.config import settings
from app.services.metadata import (
    get_athena_client,
    get_s3_client,
    get_workgroup_output_location,
    resolve_athena_catalog,
    uses_managed_query_results,
)


def _resolve_output_location() -> str:
    location = get_workgroup_output_location()
    if location:
        return location
    raise ValueError(
        "No Athena query output location found. "
        "Run at least one query in the AWS Athena console (to set the default S3 path), "
        "set ATHQL_ATHENA_OUTPUT_LOCATION in config/athql.env, "
        f"or configure an output path on workgroup '{settings.athena_workgroup}'."
    )


def start_query(sql: str, database: str | None = None, catalog: str | None = None) -> str:
    client = get_athena_client()
    params: dict[str, Any] = {
        "QueryString": sql,
        "WorkGroup": settings.athena_workgroup,
    }
    if not uses_managed_query_results():
        params["ResultConfiguration"] = {"OutputLocation": _resolve_output_location()}
    if database:
        params["QueryExecutionContext"] = {"Database": database}
        athena_catalog = resolve_athena_catalog(catalog)
        if athena_catalog:
            params["QueryExecutionContext"]["Catalog"] = athena_catalog

    response = client.start_query_execution(**params)
    return response["QueryExecutionId"]


def get_query_status(execution_id: str) -> dict[str, Any]:
    client = get_athena_client()
    response = client.get_query_execution(QueryExecutionId=execution_id)
    execution = response["QueryExecution"]
    status = execution["Status"]["State"]
    stats = execution.get("Statistics", {})

    result: dict[str, Any] = {
        "id": execution_id,
        "status": status,
        "data_scanned_bytes": stats.get("DataScannedInBytes"),
        "execution_time_ms": stats.get("EngineExecutionTimeInMillis"),
        "error_message": execution["Status"].get("StateChangeReason"),
    }

    if status == "SUCCEEDED":
        output_location = execution["ResultConfiguration"]["OutputLocation"]
        result["output_location"] = output_location
        result["cost_usd"] = _estimate_cost(stats.get("DataScannedInBytes", 0))

    return result


def _estimate_cost(data_scanned_bytes: int) -> float:
    gb = data_scanned_bytes / (1024**3)
    return round(gb * 0.005, 6)


def fetch_preview_rows(execution_id: str, limit: int | None = None) -> dict[str, Any]:
    limit = limit or settings.preview_row_limit
    try:
        return _fetch_preview_from_api(execution_id, limit)
    except Exception:
        return _fetch_preview_from_s3(execution_id, limit)


def _fetch_preview_from_api(execution_id: str, limit: int) -> dict[str, Any]:
    client = get_athena_client()
    response = client.get_query_results(QueryExecutionId=execution_id, MaxResults=limit + 1)
    rows_data = response["ResultSet"]["Rows"]
    if not rows_data:
        return {"columns": [], "rows": [], "row_count": 0}

    headers = [col.get("VarCharValue", "") for col in rows_data[0]["Data"]]
    columns = [{"name": h, "type": "string"} for h in headers]
    rows: list[dict[str, str | None]] = []
    for row in rows_data[1:]:
        values = [col.get("VarCharValue") for col in row["Data"]]
        rows.append(dict(zip(headers, values)))

    return {"columns": columns, "rows": rows, "row_count": len(rows)}


def _fetch_preview_from_s3(execution_id: str, limit: int) -> dict[str, Any]:
    status = get_query_status(execution_id)
    output_location = status.get("output_location")
    if not output_location:
        raise ValueError("Query output location unavailable")
    return fetch_preview_from_output_location(output_location, limit)


def _parse_s3_location(output_location: str) -> tuple[str, str]:
    parsed = urlparse(output_location)
    bucket = parsed.netloc
    key = parsed.path.lstrip("/")
    if not bucket or not key:
        raise ValueError(f"Invalid S3 output location: {output_location}")
    return bucket, key


def fetch_preview_from_output_location(output_location: str, limit: int | None = None) -> dict[str, Any]:
    limit = limit or settings.preview_row_limit
    bucket, key = _parse_s3_location(output_location)

    s3 = get_s3_client()
    obj = s3.get_object(Bucket=bucket, Key=key)
    body = obj["Body"].read().decode("utf-8")

    reader = csv.reader(io.StringIO(body))
    try:
        headers = next(reader)
    except StopIteration:
        return {"columns": [], "rows": [], "row_count": 0}

    columns = [{"name": h, "type": "string"} for h in headers]
    rows: list[dict[str, str]] = []
    for _ in range(limit):
        try:
            row = next(reader)
            rows.append(dict(zip(headers, row)))
        except StopIteration:
            break

    return {"columns": columns, "rows": rows, "row_count": len(rows)}


def generate_download_url_for_output_location(output_location: str, expires_in: int = 3600) -> str:
    bucket, key = _parse_s3_location(output_location)
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def generate_download_url(execution_id: str, expires_in: int = 3600) -> str:
    status = get_query_status(execution_id)
    output_location = status.get("output_location")
    if not output_location:
        raise ValueError("Query has no output yet")
    return generate_download_url_for_output_location(output_location, expires_in=expires_in)


def cancel_query(execution_id: str) -> None:
    get_athena_client().stop_query_execution(QueryExecutionId=execution_id)
