import type { HistoryEntry, LoadedQuery, QueryStatus, SavedQuery } from "../types";

function terminalRestoredStatus(entry: {
  status: string;
  data_scanned_bytes?: number | null;
  execution_time_ms?: number | null;
  error_message?: string | null;
}): LoadedQuery["restoredStatus"] {
  if (entry.status !== "SUCCEEDED" && entry.status !== "FAILED" && entry.status !== "CANCELLED") {
    return undefined;
  }
  return {
    status: entry.status as QueryStatus["status"],
    data_scanned_bytes: entry.data_scanned_bytes ?? undefined,
    execution_time_ms: entry.execution_time_ms ?? undefined,
    error_message: entry.error_message ?? undefined,
  };
}

export function loadedQueryFromHistory(item: HistoryEntry): LoadedQuery {
  const isSucceeded = item.status === "SUCCEEDED";
  return {
    sql: item.sql_text,
    executionId: isSucceeded ? item.id : undefined,
    outputLocation: item.output_location ?? undefined,
    restoredStatus: terminalRestoredStatus(item),
  };
}

export function loadedQueryFromSaved(item: SavedQuery): LoadedQuery {
  const hasSavedResult = !!item.last_output_location;
  return {
    sql: item.sql_text,
    title: item.name,
    database: item.database_context ?? undefined,
    catalog: item.catalog_context ?? undefined,
    savedQueryId: item.id,
    executionId: hasSavedResult ? (item.last_execution_id ?? undefined) : undefined,
    outputLocation: item.last_output_location ?? undefined,
    restoredStatus: hasSavedResult
      ? {
          status: "SUCCEEDED",
          data_scanned_bytes: item.last_data_scanned_bytes ?? undefined,
          execution_time_ms: item.last_execution_time_ms ?? undefined,
        }
      : undefined,
  };
}
