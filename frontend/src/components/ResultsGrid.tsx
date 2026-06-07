import { DownloadOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { api } from "../api/client";
import type { ProcessedResult } from "../workers/resultProcessor.worker";
import type { QueryStatus } from "../types";

interface ResultsGridProps {
  status?: QueryStatus;
  processed: ProcessedResult | null;
  isLoading: boolean;
  executionId?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function ResultsGrid({ status, processed, isLoading, executionId }: ResultsGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(240);

  useLayoutEffect(() => {
    const node = gridRef.current;
    if (!node) return;

    const updateScrollHeight = () => {
      const toolbar = node.querySelector(".athql-results-toolbar");
      const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
      setScrollY(Math.max(120, node.clientHeight - toolbarHeight));
    };

    updateScrollHeight();
    const observer = new ResizeObserver(updateScrollHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [status?.status, processed?.dataSource.length, isLoading]);

  const columns: ColumnsType<Record<string, unknown>> = useMemo(() => {
    if (!processed) return [];
    return processed.columns.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      width: 160,
      ellipsis: true,
      align: ["integer", "number", "decimal"].includes(col.type) ? ("right" as const) : ("left" as const),
      render: (value: unknown) => (value == null ? <Typography.Text type="secondary">NULL</Typography.Text> : String(value)),
    }));
  }, [processed]);

  const handleDownload = async () => {
    if (!executionId) return;
    const { url } = await api.downloadUrl(executionId);
    window.open(url, "_blank");
  };

  if (status?.status === "FAILED") {
    return (
      <Alert
        className="athql-result-alert"
        type="error"
        message="Query failed"
        description={status.error_message}
        showIcon
      />
    );
  }

  if (status && !["SUCCEEDED"].includes(status.status)) {
    return (
      <Alert
        className="athql-result-alert"
        type="info"
        message={`Query ${status.status.toLowerCase()}…`}
        showIcon
      />
    );
  }

  if (!status && !isLoading) {
    return (
      <div ref={gridRef} className="athql-results-grid" style={{ justifyContent: "center", alignItems: "center", height: "100%", background: "var(--athql-surface-subtle)" }}>
        <Empty
          description={
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              No query executed yet. Press <kbd style={{ padding: "2px 4px", background: "var(--athql-tag-bg)", border: "1px solid var(--athql-border)", borderRadius: 3, fontSize: 11, fontFamily: "monospace" }}>Cmd/Ctrl+Enter</kbd> to run.
            </Typography.Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div ref={gridRef} className="athql-results-grid">
      {status && (
        <div className="athql-results-toolbar">
          <Typography.Text type="secondary">
            Scanned: {formatBytes(status.data_scanned_bytes)} ·{" "}
            {status.execution_time_ms != null ? `${(status.execution_time_ms / 1000).toFixed(2)}s` : "—"} ·{" "}
            {status.cost_usd != null ? `$${status.cost_usd.toFixed(4)}` : "—"}
          </Typography.Text>
          {executionId && (
            <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>
              Download full CSV
            </Button>
          )}
        </div>
      )}

      <div className="athql-results-table-wrap">
        <Table
          size="small"
          loading={isLoading}
          columns={columns}
          dataSource={processed?.dataSource ?? []}
          rowKey="__rowKey"
          pagination={false}
          scroll={{ x: "max-content", y: scrollY }}
        />
      </div>
    </div>
  );
}
