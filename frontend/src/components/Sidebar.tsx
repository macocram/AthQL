import { DatabaseOutlined, FolderOutlined, HistoryOutlined, SettingOutlined } from "@ant-design/icons";
import { Tabs } from "antd";

import { CatalogTree } from "./CatalogTree";
import { QueryHistoryPanel } from "./QueryHistoryPanel";
import { SavedQueriesPanel } from "./SavedQueriesPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { CatalogContext, LoadedQuery } from "../types";

interface SidebarProps {
  onInsertText: (text: string) => void;
  onContextChange: (context: CatalogContext) => void;
  onLoadQuery: (query: LoadedQuery) => void;
  onTablesLoaded: (database: string, tables: string[]) => void;
  onColumnsLoaded: (database: string, table: string, columns: string[]) => void;
}

export function Sidebar({
  onInsertText,
  onContextChange,
  onLoadQuery,
  onTablesLoaded,
  onColumnsLoaded,
}: SidebarProps) {
  return (
    <Tabs
      defaultActiveKey="catalog"
      size="small"
      style={{ height: "100%" }}
      tabBarStyle={{ margin: "0 12px" }}
      items={[
        {
          key: "catalog",
          label: <DatabaseOutlined />,
          children: (
            <CatalogTree
              onInsertText={onInsertText}
              onContextChange={onContextChange}
              onTablesLoaded={onTablesLoaded}
              onColumnsLoaded={onColumnsLoaded}
            />
          ),
        },
        {
          key: "saved",
          label: <FolderOutlined />,
          children: <SavedQueriesPanel onLoadQuery={onLoadQuery} />,
        },
        {
          key: "history",
          label: <HistoryOutlined />,
          children: <QueryHistoryPanel onLoadQuery={onLoadQuery} />,
        },
        {
          key: "settings",
          label: <SettingOutlined />,
          children: <SettingsPanel />,
        },
      ]}
    />
  );
}
