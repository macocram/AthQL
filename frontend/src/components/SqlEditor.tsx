import Editor from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";

import { api } from "../api/client";
import { useNotify } from "../hooks/useNotify";
import type { SqlCompletionContext } from "../types";
import { ensureSqlCompletionProvider, updateSqlCompletionState } from "../utils/sqlCompletionProvider";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  completions?: SqlCompletionContext;
  database?: string;
  onRun?: () => void;
  onFormatRef?: React.MutableRefObject<(() => void) | null>;
  isDark?: boolean;
}

export function SqlEditor({
  value,
  onChange,
  completions,
  database,
  onRun,
  onFormatRef,
  isDark = true,
}: SqlEditorProps) {
  const { message } = useNotify();
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useEffect(() => {
    updateSqlCompletionState(completions ?? { tables: [], columns: [], columnsByTable: {} }, database);
  }, [completions, database]);

  const formatSql = useCallback(async () => {
    const sql = editorRef.current?.getValue() ?? value;
    if (!sql.trim()) return;

    try {
      const result = await api.format(sql);
      onChange(result.sql);
      message.success("SQL formatted");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Format failed");
    }
  }, [value, onChange, message]);

  useEffect(() => {
    if (!onFormatRef) return;
    onFormatRef.current = formatSql;
    return () => {
      onFormatRef.current = null;
    };
  }, [formatSql, onFormatRef]);

  const handleBeforeMount = useCallback((monaco: Parameters<typeof ensureSqlCompletionProvider>[0]) => {
    ensureSqlCompletionProvider(monaco);
  }, []);

  const handleMount = useCallback(
    (editor: import("monaco-editor").editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
      editorRef.current = editor;
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
        void formatSql();
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunRef.current?.();
      });
    },
    [formatSql],
  );

  return (
    <Editor
      key={isDark ? "dark" : "light"}
      height="100%"
      defaultLanguage="sql"
      theme={isDark ? "vs-dark" : "vs"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, strings: true, comments: false },
        tabCompletion: "on",
        wordBasedSuggestions: "off",
      }}
    />
  );
}
