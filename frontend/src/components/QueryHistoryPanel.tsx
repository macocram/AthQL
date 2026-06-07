import { ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Spin, Typography } from "antd";
import { useMemo } from "react";

import { api } from "../api/client";
import type { HistoryEntry, LoadedQuery } from "../types";

interface QueryHistoryPanelProps {
  onLoadQuery: (query: LoadedQuery) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(ms?: number): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(2)}s`;
}

function statusClass(status: string): string {
  return `athql-history-status athql-history-status--${status.toLowerCase()}`;
}

export function QueryHistoryPanel({ onLoadQuery }: QueryHistoryPanelProps) {
  const historyQuery = useQuery({
    queryKey: ["query-history"],
    queryFn: () => api.history(50),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some((h) => h.status === "QUEUED" || h.status === "RUNNING");
      return hasActive ? 3000 : false;
    },
  });

  const items = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  return (
    <div className="athql-sidebar-panel">
      <div className="athql-history-toolbar">
        <Typography.Text type="secondary" className="athql-history-toolbar-label">
          Recent runs
        </Typography.Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => historyQuery.refetch()} />
      </div>

      {historyQuery.isLoading ? (
        <Spin style={{ display: "block", margin: "24px auto" }} />
      ) : items.length === 0 ? (
        <Typography.Text type="secondary">No query history yet</Typography.Text>
      ) : (
        <div className="athql-history-list">
          {items.map((item) => (
            <HistoryCard key={item.id} item={item} onLoad={() => onLoadQuery({ sql: item.sql_text })} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item, onLoad }: { item: HistoryEntry; onLoad: () => void }) {
  return (
    <button type="button" className="athql-history-card" onClick={onLoad}>
      <div className="athql-history-card-header">
        <span className={statusClass(item.status)}>{item.status}</span>
        <span className="athql-history-time">{formatWhen(item.executed_at)}</span>
      </div>

      <pre className="athql-history-sql">{item.sql_text.trim()}</pre>

      <div className="athql-history-card-footer">
        <span className="athql-history-stats">
          {formatBytes(item.data_scanned_bytes)} scanned · {formatDuration(item.execution_time_ms)}
        </span>
      </div>

      {item.error_message && <p className="athql-history-error">{item.error_message}</p>}
    </button>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString();
  } catch {
    return iso;
  }
}
