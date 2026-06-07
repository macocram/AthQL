import { DatabaseOutlined, FolderOutlined, HistoryOutlined, InfoCircleOutlined, SettingOutlined } from "@ant-design/icons";
import { Tabs } from "antd";

import { CatalogTree } from "./CatalogTree";
import { QueryHistoryPanel } from "./QueryHistoryPanel";
import { SavedQueriesPanel } from "./SavedQueriesPanel";
import { SettingsPanel } from "./SettingsPanel";
import { AboutPanel } from "./AboutPanel";
import type { CatalogContext, LoadedQuery } from "../types";

interface SidebarProps {
  activeKey: string;
  onChange: (key: string) => void;
  onInsertText: (text: string) => void;
  onContextChange: (context: CatalogContext) => void;
  onLoadQuery: (query: LoadedQuery) => void;
  onTablesLoaded: (database: string, tables: string[]) => void;
  onColumnsLoaded: (database: string, table: string, columns: string[]) => void;
}

export function Sidebar({
  activeKey,
  onChange,
  onInsertText,
  onContextChange,
  onLoadQuery,
  onTablesLoaded,
  onColumnsLoaded,
}: SidebarProps) {
  return (
    <Tabs
      activeKey={activeKey}
      onChange={onChange}
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
        {
          key: "about",
          label: <InfoCircleOutlined />,
          children: <AboutPanel />,
        },
      ]}
    />
  );
}
