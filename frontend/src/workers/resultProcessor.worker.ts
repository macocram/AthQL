import type { ColumnMeta } from "../types";

export interface ProcessedResult {
  columns: ColumnMeta[];
  dataSource: Record<string, unknown>[];
  rowCount: number;
}

self.onmessage = (event: MessageEvent<{ columns: ColumnMeta[]; rows: Record<string, unknown>[] }>) => {
  const { columns, rows } = event.data;
  const dataSource = rows.map((row, index) => ({
    __rowKey: index,
    ...row,
  }));

  const result: ProcessedResult = {
    columns,
    dataSource,
    rowCount: rows.length,
  };

  self.postMessage(result);
};

export {};
