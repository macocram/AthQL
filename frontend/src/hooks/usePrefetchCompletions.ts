import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { extractTablesFromSql } from "../utils/sqlContext";

export function usePrefetchCompletions(
  catalog: string | undefined,
  database: string | undefined,
  sql: string,
  addTables: (database: string, tables: string[]) => void,
  addColumns: (database: string, table: string, columns: string[]) => void,
) {
  const loadedTablesRef = useRef<string | null>(null);
  const loadedColumnsRef = useRef(new Set<string>());
  const knownTablesRef = useRef(new Set<string>());
  const [knownTableCount, setKnownTableCount] = useState(0);

  useEffect(() => {
    if (!catalog || !database) return;

    let cancelled = false;
    const cacheKey = `${catalog}:${database}`;

    (async () => {
      if (loadedTablesRef.current === cacheKey) return;

      try {
        const tables = await api.tables(catalog, database);
        if (cancelled) return;
        loadedTablesRef.current = cacheKey;
        knownTablesRef.current = new Set(tables.map((t) => t.name.toLowerCase()));
        setKnownTableCount(tables.length);
        addTables(database, tables.map((t) => t.name));
      } catch {
        // Metadata may be unavailable; completions stay empty for this database.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalog, database, addTables]);

  useEffect(() => {
    if (!catalog || !database) return;
    if (knownTablesRef.current.size === 0) return;

    const tables = extractTablesFromSql(sql).filter((table) =>
      knownTablesRef.current.has(table.toLowerCase()),
    );
    if (tables.length === 0) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const table of tables) {
          const key = `${catalog}:${database}:${table}`;
          if (loadedColumnsRef.current.has(key)) continue;

          try {
            const columns = await api.columns(catalog, database, table);
            if (cancelled) return;
            loadedColumnsRef.current.add(key);
            addColumns(
              database,
              table,
              columns.map((c) => c.name),
            );
          } catch {
            // Invalid or missing table; don't retry on every keystroke.
            loadedColumnsRef.current.add(key);
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [catalog, database, sql, addColumns, knownTableCount]);
}
