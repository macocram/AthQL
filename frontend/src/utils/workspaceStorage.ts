const STORAGE_KEY = "athql-workspace";

export interface WorkspacePrefs {
  database?: string;
  catalog?: string;
}

export function loadWorkspacePrefs(): WorkspacePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WorkspacePrefs;
    let catalog = typeof parsed.catalog === "string" ? parsed.catalog : undefined;
    // Migrate legacy saves that stored the AWS account ID instead of AwsDataCatalog.
    if (catalog && /^\d{12}$/.test(catalog)) {
      catalog = "AwsDataCatalog";
    }
    return {
      database: typeof parsed.database === "string" ? parsed.database : undefined,
      catalog,
    };
  } catch {
    return {};
  }
}

export function saveWorkspacePrefs(prefs: WorkspacePrefs) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      database: prefs.database ?? null,
      catalog: prefs.catalog ?? null,
    }),
  );
}
