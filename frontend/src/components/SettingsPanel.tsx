import { DeleteOutlined, ReloadOutlined, ToolOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, InputNumber, Modal, Popconfirm, Segmented, Space, Statistic, Typography } from "antd";
import { useState } from "react";

import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useNotify } from "../hooks/useNotify";
import type { StorageCleanupAction } from "../types";

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const { mode, setMode } = useTheme();
  const { message } = useNotify();
  const [keepCount, setKeepCount] = useState(500);
  const [olderThanDays, setOlderThanDays] = useState(30);

  const statsQuery = useQuery({
    queryKey: ["storage-stats"],
    queryFn: api.storageStats,
  });

  const cleanup = useMutation({
    mutationFn: api.storageCleanup,
    onSuccess: (result) => {
      message.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
      queryClient.invalidateQueries({ queryKey: ["query-history"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const runCleanup = (action: StorageCleanupAction, extra?: { days?: number; keep?: number }) => {
    cleanup.mutate({ action, ...extra });
  };

  const confirmDestructive = (title: string, content: string, onOk: () => void) => {
    Modal.confirm({
      title,
      content,
      okText: "Confirm",
      okButtonProps: { danger: true },
      onOk,
    });
  };

  const stats = statsQuery.data;

  return (
    <div className="athql-sidebar-panel">
      <div className="athql-settings-section" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <Typography.Text className="athql-settings-section-title">Appearance</Typography.Text>
        <div className="athql-settings-action">
          <div>
            <Typography.Text>Theme</Typography.Text>
            <Typography.Paragraph type="secondary" className="athql-settings-desc">
              Switch between light and dark mode. Preference is saved locally.
            </Typography.Paragraph>
          </div>
          <Segmented
            size="small"
            value={mode}
            onChange={(value) => setMode(value as "light" | "dark")}
            options={[
              { label: "Light", value: "light" },
              { label: "Dark", value: "dark" },
            ]}
          />
        </div>
      </div>

      <div className="athql-settings-header">
        <Typography.Text strong>Storage</Typography.Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => statsQuery.refetch()} />
      </div>

      {statsQuery.isLoading ? (
        <Typography.Text type="secondary">Loading stats…</Typography.Text>
      ) : stats ? (
        <>
          <div className="athql-settings-stats">
            <Statistic title="Database" value={stats.db_size_human} valueStyle={{ fontSize: 18 }} />
            <Statistic title="History" value={stats.counts.query_history} valueStyle={{ fontSize: 18 }} />
            <Statistic title="Saved" value={stats.counts.saved_queries} valueStyle={{ fontSize: 18 }} />
          </div>

          <Typography.Text type="secondary" className="athql-settings-path">
            {stats.db_path}
          </Typography.Text>

          {stats.history_oldest && (
            <Typography.Text type="secondary" className="athql-settings-meta">
              History range: {formatWhen(stats.history_oldest)} → {formatWhen(stats.history_newest ?? "")}
            </Typography.Text>
          )}

          <div className="athql-settings-section">
            <Typography.Text className="athql-settings-section-title">Smart cleanup</Typography.Text>

            <div className="athql-settings-action">
              <div>
                <Typography.Text>Keep latest N entries</Typography.Text>
                <Typography.Paragraph type="secondary" className="athql-settings-desc">
                  Trim older runs, keep recent history for reference.
                </Typography.Paragraph>
              </div>
              <Space>
                <InputNumber min={50} max={10000} step={50} value={keepCount} onChange={(v) => setKeepCount(v ?? 500)} size="small" />
                <Button
                  size="small"
                  loading={cleanup.isPending}
                  onClick={() => runCleanup("history_keep_last", { keep: keepCount })}
                >
                  Trim
                </Button>
              </Space>
            </div>

            <div className="athql-settings-action">
              <div>
                <Typography.Text>Remove older than</Typography.Text>
                <Typography.Paragraph type="secondary" className="athql-settings-desc">
                  Delete history beyond a retention window.
                </Typography.Paragraph>
              </div>
              <Space>
                <InputNumber min={1} max={365} value={olderThanDays} onChange={(v) => setOlderThanDays(v ?? 30)} size="small" addonAfter="days" />
                <Button
                  size="small"
                  loading={cleanup.isPending}
                  onClick={() => runCleanup("history_older_than", { days: olderThanDays })}
                >
                  Clean
                </Button>
              </Space>
            </div>

            <div className="athql-settings-action">
              <div>
                <Typography.Text>Failed & cancelled</Typography.Text>
                <Typography.Paragraph type="secondary" className="athql-settings-desc">
                  Remove {stats.counts.failed_history} non-success entries.
                </Typography.Paragraph>
              </div>
              <Popconfirm
                title="Remove failed and cancelled queries?"
                onConfirm={() => runCleanup("history_failed")}
              >
                <Button size="small" icon={<DeleteOutlined />} loading={cleanup.isPending}>
                  Clean
                </Button>
              </Popconfirm>
            </div>
          </div>

          <div className="athql-settings-section">
            <Typography.Text className="athql-settings-section-title">Maintenance</Typography.Text>

            <div className="athql-settings-action">
              <div>
                <Typography.Text>Compact database</Typography.Text>
                <Typography.Paragraph type="secondary" className="athql-settings-desc">
                  Reclaim disk space after large cleanups (SQLite VACUUM).
                </Typography.Paragraph>
              </div>
              <Button
                size="small"
                icon={<ToolOutlined />}
                loading={cleanup.isPending}
                onClick={() => runCleanup("vacuum")}
              >
                Vacuum
              </Button>
            </div>

            <div className="athql-settings-action athql-settings-action-danger">
              <div>
                <Typography.Text type="danger">Clear all history</Typography.Text>
                <Typography.Paragraph type="secondary" className="athql-settings-desc">
                  Deletes every history entry. Saved queries and folders are kept.
                </Typography.Paragraph>
              </div>
              <Button
                size="small"
                danger
                loading={cleanup.isPending}
                onClick={() =>
                  confirmDestructive(
                    "Clear all query history?",
                    "This removes all execution history. Saved queries are not affected.",
                    () => runCleanup("history_all"),
                  )
                }
              >
                Clear all
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleDateString();
  } catch {
    return iso;
  }
}
