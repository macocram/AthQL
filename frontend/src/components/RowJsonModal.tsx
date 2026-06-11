import { CopyOutlined } from "@ant-design/icons";
import { Button, Modal, Segmented, Typography } from "antd";
import { useMemo, useState } from "react";

import { formatRowJson, parseRowForJsonView } from "../utils/parseRowJson";
import { useNotify } from "../hooks/useNotify";
import { JsonTreeViewer } from "./JsonTreeViewer";

interface RowJsonModalProps {
  open: boolean;
  row: Record<string, unknown> | null;
  rowIndex?: number;
  onClose: () => void;
}

type ViewMode = "tree" | "raw";

export function RowJsonModal({ open, row, rowIndex, onClose }: RowJsonModalProps) {
  const [mode, setMode] = useState<ViewMode>("tree");
  const { message } = useNotify();

  const parsed = useMemo(() => (row ? parseRowForJsonView(row) : null), [row]);
  const rawJson = useMemo(() => (row ? formatRowJson(row) : ""), [row]);

  const handleCopy = async () => {
    if (!rawJson) return;
    try {
      await navigator.clipboard.writeText(rawJson);
      message.success("JSON copied to clipboard");
    } catch {
      message.error("Could not copy to clipboard");
    }
  };

  return (
    <Modal
      title={
        <div className="athql-row-json-modal-title">
          <span>Row JSON{rowIndex != null ? ` · #${rowIndex + 1}` : ""}</span>
          <Segmented
            size="small"
            value={mode}
            onChange={(value) => setMode(value as ViewMode)}
            options={[
              { label: "Tree", value: "tree" },
              { label: "Raw", value: "raw" },
            ]}
          />
        </div>
      }
      open={open}
      onCancel={onClose}
      width={760}
      footer={[
        <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy}>
          Copy JSON
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
      className="athql-row-json-modal"
      destroyOnClose
    >
      {parsed ? (
        mode === "tree" ? (
          <div className="athql-json-viewer">
            <JsonTreeViewer value={parsed} defaultExpanded />
          </div>
        ) : (
          <pre className="athql-json-raw">{rawJson}</pre>
        )
      ) : (
        <Typography.Text type="secondary">No row selected</Typography.Text>
      )}
    </Modal>
  );
}
