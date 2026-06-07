export function extractTablesFromSql(sql: string): string[] {
  const tables = new Set<string>();
  const pattern = /\b(?:FROM|JOIN)\s+(?:LATERAL\s+)?(?:TABLE\s*\(\s*)?[`"]?([\w.]+)[`"]?/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    const ref = match[1];
    if (!ref || ref.includes("(")) continue;
    const parts = ref.split(".");
    const table = parts[parts.length - 1];
    if (table && !isSqlKeyword(table)) {
      tables.add(table);
    }
  }

  return Array.from(tables);
}

function isSqlKeyword(word: string): boolean {
  return ["select", "where", "lateral", "unnest"].includes(word.toLowerCase());
}

export function tableLookupKeys(database: string, table: string): string[] {
  return [table, `${database}.${table}`, table.toLowerCase(), `${database}.${table}`.toLowerCase()];
}

export function resolveTableColumns(
  tableRef: string,
  database: string | undefined,
  columnsByTable: Record<string, string[]>,
): string[] {
  const candidates = new Set<string>([
    tableRef,
    tableRef.toLowerCase(),
    database ? `${database}.${tableRef}` : "",
    database ? `${database}.${tableRef}`.toLowerCase() : "",
  ]);

  for (const key of candidates) {
    if (!key) continue;
    const cols = columnsByTable[key];
    if (cols?.length) return cols;
  }

  return [];
}

export interface DotContext {
  tableRef: string;
  columnPrefix: string;
  replaceStartColumn: number;
}

export function parseDotContext(lineText: string, column: number): DotContext | null {
  const before = lineText.slice(0, column - 1);
  const match = before.match(/(?:^|[\s,(\[+])([`"]?)([\w.]+)\1\.([`]?)([\w]*)$/);
  if (!match) return null;

  const tableRef = match[2];
  const columnPrefix = match[4] ?? "";
  const dotAt = before.lastIndexOf(".");
  const replaceStartColumn = dotAt + 2;

  return { tableRef, columnPrefix, replaceStartColumn };
}
