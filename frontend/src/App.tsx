import { FormatPainterOutlined, PlayCircleOutlined, PlusOutlined, SaveOutlined, StopOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Layout, Select, Tabs, Typography } from "antd";
import { useCallback, useRef, useState } from "react";

import { api } from "./api/client";
import { Logo } from "./components/Logo";
import { QueryTabLabel } from "./components/QueryTabLabel";
import { ResultsGrid } from "./components/ResultsGrid";
import { SaveQueryModal } from "./components/SaveQueryModal";
import { Sidebar } from "./components/Sidebar";
import { SqlEditor } from "./components/SqlEditor";
import { ThemeToggle } from "./components/ThemeToggle";
import { useTheme } from "./context/ThemeContext";
import { useNotify } from "./hooks/useNotify";
import { usePrefetchCompletions } from "./hooks/usePrefetchCompletions";
import { useQueryExecution } from "./hooks/useQueryExecution";
import { useSqlCompletions } from "./hooks/useSqlCompletions";
import type { CatalogContext, LoadedQuery, QueryTab } from "./types";
import { loadWorkspacePrefs, saveWorkspacePrefs } from "./utils/workspaceStorage";

const { Sider, Content } = Layout;

function newTab(num: number, prefs = loadWorkspacePrefs()): QueryTab {
  return {
    key: `tab-${Date.now()}-${num}`,
    label: `q${num}`,
    sql: "-- Write your Athena SQL here\nSELECT 1",
    database: prefs.database,
    catalog: prefs.catalog,
  };
}

function persistDatabaseContext(database?: string, catalog?: string) {
  saveWorkspacePrefs({ database, catalog });
}

function QueryPanel({
  tab,
  onUpdate,
  onSave,
  onExecuted,
  completions,
  addTables,
  addColumns,
  isDark,
}: {
  tab: QueryTab;
  onUpdate: (patch: Partial<QueryTab>) => void;
  onSave: () => void;
  onExecuted?: () => void;
  completions: ReturnType<typeof useSqlCompletions>["completions"];
  addTables: ReturnType<typeof useSqlCompletions>["addTables"];
  addColumns: ReturnType<typeof useSqlCompletions>["addColumns"];
  isDark: boolean;
}) {
  const { message } = useNotify();
  const formatRef = useRef<(() => void) | null>(null);
  const { status, isPolling, processed, isLoadingResults } = useQueryExecution(tab.executionId);

  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: api.catalogs,
  });

  const activeCatalog = tab.catalog ?? catalogsQuery.data?.[0]?.name;

  const databasesQuery = useQuery({
    queryKey: ["databases", activeCatalog],
    queryFn: () => api.databases(activeCatalog!),
    enabled: !!activeCatalog,
  });

  const runQuery = useCallback(async () => {
    if (isPolling) return;
    try {
      const { execution_id } = await api.execute(tab.sql, tab.database, tab.catalog);
      onUpdate({ executionId: execution_id });
      onExecuted?.();
      message.success("Query submitted");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Execution failed");
    }
  }, [isPolling, tab.sql, tab.database, tab.catalog, onUpdate, onExecuted, message]);

  const cancelQuery = async () => {
    if (!tab.executionId) return;
    try {
      await api.cancel(tab.executionId);
      message.info("Cancellation requested");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  usePrefetchCompletions(activeCatalog, tab.database, tab.sql, addTables, addColumns);

  return (
    <div className="athql-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="athql-toolbar">
        <div className="athql-toolbar-left">
          <Select
            allowClear
            showSearch
            placeholder="Database"
            value={tab.database}
            onChange={(database) =>
              onUpdate({
                database: database || undefined,
                catalog: activeCatalog,
              })
            }
            loading={databasesQuery.isLoading}
            options={(databasesQuery.data ?? []).map((db) => ({ label: db.name, value: db.name }))}
            className="athql-toolbar-select"
            size="small"
          />
          <div className="athql-toolbar-actions">
            <Button
              type="primary"
              size="small"
              className="athql-btn-run"
              icon={<PlayCircleOutlined />}
              onClick={runQuery}
              loading={isPolling}
            >
              Run
            </Button>
            <div className="athql-btn-group">
              <Button
                size="small"
                type="text"
                icon={<StopOutlined />}
                onClick={cancelQuery}
                disabled={!tab.executionId || !isPolling}
              >
                Cancel
              </Button>
              <Button size="small" type="text" icon={<SaveOutlined />} onClick={onSave}>
                Save
              </Button>
              <Button
                size="small"
                type="text"
                icon={<FormatPainterOutlined />}
                onClick={() => formatRef.current?.()}
              >
                Format
              </Button>
            </div>
          </div>
        </div>
        <Typography.Text type="secondary" className="athql-toolbar-hint">
          Cmd/Ctrl+Enter to run · Cmd/Ctrl+Shift+F to format
        </Typography.Text>
      </div>
      <div style={{ flex: 1, minHeight: 240 }}>
        <SqlEditor
          value={tab.sql}
          onChange={(sql) => onUpdate({ sql })}
          completions={completions}
          database={tab.database}
          onRun={runQuery}
          onFormatRef={formatRef}
          isDark={isDark}
        />
      </div>
      <div className="athql-results-pane" style={{ height: "42%" }}>
        <ResultsGrid
          status={status}
          processed={processed}
          isLoading={isLoadingResults}
          executionId={tab.executionId}
        />
      </div>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const { message } = useNotify();
  const { completions, addTables, addColumns } = useSqlCompletions();
  const [tabs, setTabs] = useState<QueryTab[]>(() => [newTab(1)]);
  const [activeKey, setActiveKey] = useState(() => tabs[0].key);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const nextTabNum = useRef(2);

  const activeTab = tabs.find((t) => t.key === activeKey);

  const updateTab = useCallback((key: string, patch: Partial<QueryTab>) => {
    setTabs((prev) => {
      const next = prev.map((t) => (t.key === key ? { ...t, ...patch } : t));
      if ("database" in patch || "catalog" in patch) {
        const updated = next.find((t) => t.key === key);
        if (updated) {
          persistDatabaseContext(updated.database, updated.catalog);
        }
      }
      return next;
    });
  }, []);

  const addTab = () => {
    const tab = newTab(nextTabNum.current++);
    setTabs((prev) => [...prev, tab]);
    setActiveKey(tab.key);
  };

  const applyContextToActive = useCallback(
    (context: CatalogContext) => {
      updateTab(activeKey, { database: context.database, catalog: context.catalog });
    },
    [activeKey, updateTab],
  );

  const insertIntoActive = (text: string) => {
    const tab = tabs.find((t) => t.key === activeKey);
    if (!tab) return;
    updateTab(activeKey, { sql: `${tab.sql}\n${text}` });
  };

  const loadQueryIntoActive = (query: LoadedQuery) => {
    updateTab(activeKey, {
      sql: query.sql,
      name: query.title,
      label: query.title ?? tabs.find((t) => t.key === activeKey)?.label ?? "q1",
      database: query.database,
      catalog: query.catalog,
      updateSavedQueryId: query.savedQueryId,
      executionId: undefined,
    });
    message.success("Query loaded");
  };

  const openSaveModal = () => {
    if (!activeTab) return;
    setSaveModalOpen(true);
  };

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider width={300} className="athql-sider">
        <div className="athql-header">
          <div className="athql-header-main">
            <Logo size={32} />
            <div>
              <Typography.Title level={5} className="athql-header-title">
                AthQL
              </Typography.Title>
              <div className="athql-header-subtitle">Athena Query Manager</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div style={{ height: "calc(100vh - 65px)" }}>
          <Sidebar
            onInsertText={insertIntoActive}
            onContextChange={applyContextToActive}
            onLoadQuery={loadQueryIntoActive}
            onTablesLoaded={addTables}
            onColumnsLoaded={addColumns}
          />
        </div>
      </Sider>
      <Content className="athql-content" style={{ padding: 12 }}>
        <Tabs
          type="editable-card"
          activeKey={activeKey}
          onChange={setActiveKey}
          onEdit={(targetKey, action) => {
            if (action === "add") {
              addTab();
              return;
            }
            if (action === "remove" && typeof targetKey === "string" && tabs.length > 1) {
              const next = tabs.filter((t) => t.key !== targetKey);
              setTabs(next);
              if (activeKey === targetKey) setActiveKey(next[0].key);
            }
          }}
          addIcon={<PlusOutlined />}
          items={tabs.map((tab) => ({
            key: tab.key,
            label: (
              <QueryTabLabel
                label={tab.label}
                onRename={(label) => updateTab(tab.key, { label })}
              />
            ),
            children: (
              <QueryPanel
                tab={tab}
                onUpdate={(patch) => updateTab(tab.key, patch)}
                onSave={openSaveModal}
                onExecuted={() => queryClient.invalidateQueries({ queryKey: ["query-history"] })}
                completions={completions}
                addTables={addTables}
                addColumns={addColumns}
                isDark={isDark}
              />
            ),
          }))}
          style={{ height: "100%" }}
          tabBarStyle={{ margin: 0 }}
        />
      </Content>

      {activeTab && (
        <SaveQueryModal
          open={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          initialName={activeTab.name ?? activeTab.label}
          sql={activeTab.sql}
          database={activeTab.database}
          catalog={activeTab.catalog}
          updateSavedQueryId={activeTab.updateSavedQueryId}
          onSaved={(saved) =>
            updateTab(activeKey, {
              name: saved.name,
              label: saved.name,
              updateSavedQueryId: saved.id === activeTab.updateSavedQueryId ? saved.id : undefined,
            })
          }
        />
      )}
    </Layout>
  );
}
