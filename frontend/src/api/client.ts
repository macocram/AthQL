import type {
  Folder,
  HistoryEntry,
  QueryResult,
  QueryStatus,
  SavedQuery,
  StorageCleanupAction,
  StorageCleanupResult,
  StorageStats,
} from "../types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(detail.detail || response.statusText);
  }
  return response.json();
}

export const api = {
  health: () => request<{ status: string; version: string }>("/health"),
  profile: () =>
    request<{
      profile: string;
      region: string;
      access_key_hint?: string;
      athena_workgroup?: string;
      athena_output_location?: string | null;
      athena_ready?: boolean;
      warnings?: string[];
    }>("/metadata/profile"),
  refreshMetadata: () => request<{ status: string }>("/metadata/refresh", { method: "POST" }),
  catalogs: () => request<{ name: string; type: string; label?: string }[]>("/metadata/catalogs"),
  databases: (catalog: string) =>
    request<{ name: string; description: string }[]>(`/metadata/catalogs/${catalog}/databases`),
  tables: (catalog: string, database: string) =>
    request<{ name: string; type: string }[]>(
      `/metadata/catalogs/${catalog}/databases/${database}/tables`,
    ),
  columns: (catalog: string, database: string, table: string) =>
    request<{ name: string; type: string; partition?: string }[]>(
      `/metadata/catalogs/${catalog}/databases/${database}/tables/${table}/columns`,
    ),
  execute: (sql: string, database?: string, catalog?: string, savedQueryId?: string) =>
    request<{ execution_id: string }>("/queries/execute", {
      method: "POST",
      body: JSON.stringify({ sql, database, catalog, saved_query_id: savedQueryId }),
    }),
  status: (executionId: string) => request<QueryStatus>(`/queries/${executionId}/status`),
  results: (executionId: string, limit = 200) =>
    request<QueryResult>(`/queries/${executionId}/results?limit=${limit}`),
  resultsByOutputLocation: (location: string, limit = 200) =>
    request<QueryResult>(
      `/queries/results/by-output-location?location=${encodeURIComponent(location)}&limit=${limit}`,
    ),
  downloadUrl: (executionId: string) => request<{ url: string }>(`/queries/${executionId}/download-url`),
  downloadUrlByOutputLocation: (location: string) =>
    request<{ url: string }>(
      `/queries/download-url/by-output-location?location=${encodeURIComponent(location)}`,
    ),
  cancel: (executionId: string) =>
    request<{ status: string }>(`/queries/${executionId}/cancel`, { method: "POST" }),
  format: (sql: string) => request<{ sql: string }>("/queries/format", { method: "POST", body: JSON.stringify({ sql }) }),
  history: (limit = 50) => request<HistoryEntry[]>(`/queries/history?limit=${limit}`),
  savedQueries: (params?: { tag?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.tag) search.set("tag", params.tag);
    if (params?.q) search.set("q", params.q);
    const qs = search.toString();
    return request<SavedQuery[]>(`/queries/saved${qs ? `?${qs}` : ""}`);
  },
  savedQueryTags: () => request<string[]>("/queries/saved/tags"),
  createSavedQuery: (body: {
    name: string;
    sql_text: string;
    folder_id?: string | null;
    folder_name?: string | null;
    database_context?: string | null;
    catalog_context?: string | null;
    tags?: string[];
  }) => request<SavedQuery>("/queries/saved", { method: "POST", body: JSON.stringify(body) }),
  updateSavedQuery: (
    id: string,
    body: {
      name?: string;
      sql_text?: string;
      folder_id?: string | null;
      folder_name?: string | null;
      database_context?: string | null;
      catalog_context?: string | null;
      tags?: string[];
    },
  ) => request<SavedQuery>(`/queries/saved/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSavedQuery: (id: string) => request<{ deleted: string }>(`/queries/saved/${id}`, { method: "DELETE" }),
  folders: () => request<Folder[]>("/queries/folders"),
  createFolder: (body: { name: string; parent_id?: string | null }) =>
    request<Folder>("/queries/folders", { method: "POST", body: JSON.stringify(body) }),
  reorderFolders: (folderIds: string[]) =>
    request<{ status: string }>("/queries/folders/reorder", {
      method: "POST",
      body: JSON.stringify({ folder_ids: folderIds }),
    }),
  storageStats: () => request<StorageStats>("/settings/storage"),
  storageCleanup: (body: { action: StorageCleanupAction; days?: number; keep?: number }) =>
    request<StorageCleanupResult>("/settings/storage/cleanup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
