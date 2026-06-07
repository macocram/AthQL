import { useQuery } from "@tanstack/react-query";
import { Button, Typography } from "antd";

import { api } from "../api/client";
import { Logo } from "./Logo";

export function AboutPanel() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
  });

  return (
    <div
      className="athql-sidebar-panel"
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        textAlign: "center",
        padding: "32px 16px",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Logo size={48} />
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}>
            AthQL
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Athena Query Manager
          </Typography.Text>
        </div>
      </div>

      <div
        style={{
          background: "var(--athql-surface-subtle)",
          border: "1px solid var(--athql-border-subtle)",
          borderRadius: "var(--athql-radius)",
          padding: "12px 16px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Typography.Text style={{ fontSize: "10px", fontWeight: "650", color: "var(--athql-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            App Version
          </Typography.Text>
          <Typography.Text style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "11px", fontWeight: "600", color: "var(--athql-text-strong)" }}>
            {healthQuery.data?.version ? `v${healthQuery.data.version}` : "..."}
          </Typography.Text>
        </div>
        <Typography.Paragraph type="secondary" style={{ fontSize: "11px", margin: 0, textAlign: "left", lineHeight: "1.5" }}>
          AthQL is a lightweight, local client for AWS Athena. It features offline query history, query organization via folders, database schemas exploration, and high-performance result grids.
        </Typography.Paragraph>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <Button
          type="primary"
          href="https://amit3200.github.io/AthQL/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ width: "100%", fontWeight: "600" }}
          size="small"
        >
          Documentation Website
        </Button>
        <Button
          href="https://github.com/amit3200/AthQL"
          target="_blank"
          rel="noopener noreferrer"
          style={{ width: "100%" }}
          size="small"
        >
          View GitHub Repository
        </Button>
      </div>
    </div>
  );
}
