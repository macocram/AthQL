import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Select, Space, Typography } from "antd";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { useNotify } from "../hooks/useNotify";
import type { SavedQuery } from "../types";

interface SaveQueryModalProps {
  open: boolean;
  onClose: () => void;
  initialName: string;
  sql: string;
  database?: string;
  catalog?: string;
  updateSavedQueryId?: string;
  onSaved: (saved: SavedQuery) => void;
}

export function SaveQueryModal({
  open,
  onClose,
  initialName,
  sql,
  database,
  catalog,
  updateSavedQueryId,
  onSaved,
}: SaveQueryModalProps) {
  const queryClient = useQueryClient();
  const { message } = useNotify();
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState<string[]>([]);
  const [folderMode, setFolderMode] = useState<"existing" | "new">("existing");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [saveAsNew, setSaveAsNew] = useState(false);

  const foldersQuery = useQuery({
    queryKey: ["folders"],
    queryFn: api.folders,
    enabled: open,
  });

  const tagsQuery = useQuery({
    queryKey: ["saved-query-tags"],
    queryFn: api.savedQueryTags,
    enabled: open,
  });

  const isUpdate = Boolean(updateSavedQueryId) && !saveAsNew;

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setTags([]);
    setFolderId(null);
    setNewFolderName("");
    setSaveAsNew(false);
    setFolderMode((foldersQuery.data?.length ?? 0) > 0 ? "existing" : "new");
  }, [open, initialName, foldersQuery.data?.length]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        sql_text: sql,
        database_context: database ?? null,
        catalog_context: catalog ?? null,
        tags,
        folder_id: folderMode === "existing" ? folderId : null,
        folder_name: folderMode === "new" ? newFolderName.trim() || null : null,
      };
      if (isUpdate && updateSavedQueryId) {
        return api.updateSavedQuery(updateSavedQueryId, body);
      }
      return api.createSavedQuery(body);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["saved-queries"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["saved-query-tags"] });
      onSaved(saved);
      onClose();
      message.success("Query saved");
    },
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      title={isUpdate ? "Update saved query" : "Save query"}
      open={open}
      onCancel={onClose}
      onOk={() => saveMutation.mutate()}
      confirmLoading={saveMutation.isPending}
      okText={isUpdate ? "Update" : "Save"}
      okButtonProps={{ disabled: !name.trim() }}
      className="athql-modal"
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {updateSavedQueryId && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {saveAsNew ? "Saving as a new query." : "Updating the saved query you opened from the sidebar."}{" "}
            <Button type="link" size="small" style={{ padding: 0, height: "auto" }} onClick={() => setSaveAsNew((v) => !v)}>
              {saveAsNew ? "Update existing instead" : "Save as new instead"}
            </Button>
          </Typography.Text>
        )}

        <div className="athql-form-field">
          <Typography.Text className="athql-field-label">Name</Typography.Text>
          <Input placeholder="Query name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="athql-form-field">
          <Typography.Text className="athql-field-label">Tags</Typography.Text>
          <Select
            mode="tags"
            placeholder="Add tags (e.g. analytics, daily)"
            style={{ width: "100%" }}
            value={tags}
            onChange={setTags}
            options={(tagsQuery.data ?? []).map((tag) => ({ label: tag, value: tag }))}
            tokenSeparators={[","]}
          />
        </div>

        <div className="athql-form-field">
          <div className="athql-field-row">
            <Typography.Text className="athql-field-label">Folder</Typography.Text>
            {(foldersQuery.data?.length ?? 0) > 0 && (
              <Button
                type="link"
                size="small"
                onClick={() => setFolderMode((mode) => (mode === "existing" ? "new" : "existing"))}
              >
                {folderMode === "existing" ? "+ New folder" : "Pick existing"}
              </Button>
            )}
          </div>
          {folderMode === "existing" ? (
            <Select
              allowClear
              placeholder="No folder (root)"
              style={{ width: "100%" }}
              value={folderId}
              onChange={setFolderId}
              options={(foldersQuery.data ?? []).map((f) => ({ label: f.name, value: f.id }))}
            />
          ) : (
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          )}
        </div>
      </Space>
    </Modal>
  );
}
