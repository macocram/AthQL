import type { Monaco } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";

import type { SqlCompletionContext } from "../types";
import { parseDotContext, resolveTableColumns } from "./sqlContext";

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "JOIN",
  "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "ON", "AS", "AND", "OR",
  "NOT", "IN", "EXISTS", "BETWEEN", "LIKE", "IS", "NULL", "DISTINCT", "COUNT",
  "SUM", "AVG", "MIN", "MAX", "CASE", "WHEN", "THEN", "ELSE", "END", "WITH",
  "UNION", "ALL", "CAST", "DATE", "TIMESTAMP", "INTERVAL", "OVER", "PARTITION BY",
];

let providerRegistered = false;

const completionState: {
  context: SqlCompletionContext;
  database?: string;
} = {
  context: { tables: [], columns: [], columnsByTable: {} },
  database: undefined,
};

export function updateSqlCompletionState(context: SqlCompletionContext, database?: string) {
  completionState.context = context;
  completionState.database = database;
}

export function ensureSqlCompletionProvider(monaco: Monaco) {
  if (providerRegistered) return;
  providerRegistered = true;

  monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", " ", "(", ",", "\n"],
    provideCompletionItems: (
      model: MonacoEditor.editor.ITextModel,
      position: MonacoEditor.Position,
    ) => {
      const ctx = completionState.context;
      const database = completionState.database;
      const lineText = model.getLineContent(position.lineNumber);
      const dotContext = parseDotContext(lineText, position.column);

      if (dotContext) {
        const tablePart = dotContext.tableRef.includes(".")
          ? dotContext.tableRef.split(".").pop() ?? dotContext.tableRef
          : dotContext.tableRef;
        const columns = resolveTableColumns(tablePart, database, ctx.columnsByTable);
        const prefix = dotContext.columnPrefix.toLowerCase();

        const range: MonacoEditor.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: dotContext.replaceStartColumn,
          endColumn: position.column,
        };

        const suggestions = columns
          .filter((col) => col.toLowerCase().startsWith(prefix))
          .map((label) => ({
            label,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: label,
            range,
            sortText: `0_${label}`,
          }));

        return { suggestions };
      }

      const word = model.getWordUntilPosition(position);
      const range: MonacoEditor.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const prefix = word.word.toLowerCase();

      const keywordItems = SQL_KEYWORDS.filter((kw) => kw.toLowerCase().startsWith(prefix)).map((label) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: label,
        range,
        sortText: `2_${label}`,
      }));

      const tableItems = ctx.tables
        .filter((t) => t.toLowerCase().startsWith(prefix))
        .map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: label,
          range,
          sortText: `1_${label}`,
        }));

      const columnItems = ctx.columns
        .filter((c) => !c.includes(".") && c.toLowerCase().startsWith(prefix))
        .map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: label,
          range,
          sortText: `1_${label}`,
        }));

      return { suggestions: [...tableItems, ...columnItems, ...keywordItems] };
    },
  });
}
