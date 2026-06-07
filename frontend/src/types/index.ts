export interface ColumnMeta {
  name: string;
  type: string;
  partition?: string;
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  row_count: number;
}

export interface QueryStatus {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  data_scanned_bytes?: number;
  execution_time_ms?: number;
  error_message?: string;
  cost_usd?: number;
  output_location?: string;
}

export interface QueryTab {
  key: string;
  label: string;
  name?: string;
  sql: string;
  database?: string;
  catalog?: string;
  executionId?: string;
  /** Set only when a saved query was loaded from the sidebar — enables update-in-place on save. */
  updateSavedQueryId?: string;
}

export interface AwsProfile {
  profile: string;
  region: string;
  access_key_hint?: string;
  athena_workgroup?: string;
  athena_output_location?: string | null;
  athena_ready?: boolean;
  warnings?: string[];
}

export interface HistoryEntry {
  id: string;
  sql_text: string;
  status: string;
  data_scanned_bytes?: number;
  execution_time_ms?: number;
  error_message?: string;
  executed_at: string;
}

export interface SavedQuery {
  id: string;
  folder_id: string | null;
  name: string;
  sql_text: string;
  database_context: string | null;
  catalog_context: string | null;
  tags: string[];
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface LoadedQuery {
  sql: string;
  title?: string;
  database?: string;
  catalog?: string;
  savedQueryId?: string;
}

export interface SqlCompletionContext {
  tables: string[];
  columns: string[];
  columnsByTable: Record<string, string[]>;
}

export interface CatalogContext {
  catalog: string;
  database: string;
}

export type StorageCleanupAction =
  | "history_older_than"
  | "history_keep_last"
  | "history_failed"
  | "history_all"
  | "vacuum";

export interface StorageStats {
  db_path: string;
  data_dir: string;
  db_size_bytes: number;
  db_size_human: string;
  counts: {
    query_history: number;
    saved_queries: number;
    folders: number;
    failed_history: number;
  };
  history_oldest: string | null;
  history_newest: string | null;
}

export interface StorageCleanupResult {
  deleted: number;
  message: string;
  stats: StorageStats;
  vacuum?: {
    size_before_bytes: number;
    size_after_bytes: number;
    reclaimed_bytes: number;
    size_after_human: string;
  };
}
