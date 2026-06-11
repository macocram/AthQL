import {
  DeleteOutlined,
  DownOutlined,
  FolderAddOutlined,
  FolderOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Popconfirm, Spin, Typography } from "antd";
import { useMemo, useRef, useState } from "react";

import { api } from "../api/client";
import { useNotify } from "../hooks/useNotify";
import type { Folder, LoadedQuery, SavedQuery } from "../types";
import { loadedQueryFromSaved } from "../utils/loadedQuery";

interface SavedQueriesPanelProps {
  onLoadQuery: (query: LoadedQuery) => void;
}

const TAG_PALETTE = ["blue", "green", "amber", "violet", "rose", "cyan", "orange"] as const;

export function SavedQueriesPanel({ onLoadQuery }: SavedQueriesPanelProps) {
  const queryClient = useQueryClient();
  const { message } = useNotify();
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const draggedFolderIdRef = useRef<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const foldersQuery = useQuery({ queryKey: ["folders"], queryFn: api.folders });
  const tagsQuery = useQuery({ queryKey: ["saved-query-tags"], queryFn: api.savedQueryTags });
  const savedQuery = useQuery({
    queryKey: ["saved-queries", activeTag, searchText],
    queryFn: () => api.savedQueries({ tag: activeTag ?? undefined, q: searchText || undefined }),
  });

  const grouped = useMemo(
    () => groupSavedQueries(foldersQuery.data ?? [], savedQuery.data ?? []),
    [foldersQuery.data, savedQuery.data],
  );

  const createFolder = useMutation({
    mutationFn: (name: string) => api.createFolder({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setFolderModalOpen(false);
      setNewFolderName("");
      message.success("Folder created");
    },
    onError: (err: Error) => message.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (folderIds: string[]) => api.reorderFolders(folderIds),
    onMutate: async (newOrderIds) => {
      await queryClient.cancelQueries({ queryKey: ["folders"] });
      const previousFolders = queryClient.getQueryData<Folder[]>(["folders"]);
      if (previousFolders) {
        const foldersMap = new Map(previousFolders.map((f) => [f.id, f]));
        const optimisticallyReordered = newOrderIds.map((id) => foldersMap.get(id)!).filter(Boolean);
        queryClient.setQueryData(["folders"], optimisticallyReordered);
      }
      return { previousFolders };
    },
    onError: (err, _newOrderIds, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(["folders"], context.previousFolders);
      }
      message.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });

  const deleteSaved = useMutation({
    mutationFn: api.deleteSavedQuery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-queries"] });
      queryClient.invalidateQueries({ queryKey: ["saved-query-tags"] });
      message.success("Query deleted");
    },
    onError: (err: Error) => message.error(err.message),
  });

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) next.delete(folderKey);
      else next.add(folderKey);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, folderId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", folderId);
    draggedFolderIdRef.current = folderId;
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    const draggedId = draggedFolderIdRef.current;
    if (draggedId && draggedId !== folderId && folderId !== "uncategorized" && draggedId !== "uncategorized") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverFolderId(folderId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const sourceId = e.dataTransfer.getData("text/plain") || draggedFolderIdRef.current;
    draggedFolderIdRef.current = null;
    if (!sourceId || sourceId === targetId || targetId === "uncategorized" || sourceId === "uncategorized") return;

    const currentFolders = foldersQuery.data ?? [];
    const sourceIndex = currentFolders.findIndex((f) => f.id === sourceId);
    const targetIndex = currentFolders.findIndex((f) => f.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = Array.from(currentFolders);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    reorderMutation.mutate(reordered.map((f) => f.id));
  };

  const loadQuery = (item: SavedQuery) => {
    onLoadQuery(loadedQueryFromSaved(item));
  };

  if (foldersQuery.isLoading || savedQuery.isLoading) {
    return <Spin style={{ display: "block", margin: "24px auto" }} />;
  }

  const hasContent = grouped.sections.some((section) => section.queries.length > 0) || grouped.sections.length > 0;

  return (
    <div className="athql-sidebar-panel">
      <Input
        size="small"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search name, SQL, tags…"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 8 }}
      />

      {(tagsQuery.data?.length ?? 0) > 0 && (
        <div className="athql-saved-tag-row">
          {(tagsQuery.data ?? []).map((tag) => (
            <button
              key={tag}
              type="button"
              className={`athql-tag-pill athql-tag-pill--${tagPalette(tag)}${activeTag === tag ? " athql-tag-pill--active" : ""}`}
              onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="athql-saved-toolbar">
        <Button size="small" icon={<FolderAddOutlined />} onClick={() => setFolderModalOpen(true)}>
          New folder
        </Button>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => {
            foldersQuery.refetch();
            savedQuery.refetch();
            tagsQuery.refetch();
          }}
        />
      </div>

      {!hasContent ? (
        <Typography.Text type="secondary">No saved queries yet. Use Save on a query tab.</Typography.Text>
      ) : (
        <div className="athql-saved-list">
          {grouped.sections.map((section) => {
            const expanded = expandedFolders.has(section.key);
            const isUncategorized = section.key === "uncategorized";
            return (
              <section key={section.key} className="athql-saved-folder">
                <div
                  role="button"
                  tabIndex={0}
                  draggable={!isUncategorized}
                  className={`athql-saved-folder-header ${
                    dragOverFolderId === section.key ? "athql-drag-over" : ""
                  }`}
                  onDragStart={(e) => handleDragStart(e, section.key)}
                  onDragEnd={() => {
                    draggedFolderIdRef.current = null;
                    setDragOverFolderId(null);
                  }}
                  onDragOver={(e) => handleDragOver(e, section.key)}
                  onDragLeave={() => {
                    setDragOverFolderId((curr) => (curr === section.key ? null : curr));
                  }}
                  onDrop={(e) => handleDrop(e, section.key)}
                  onClick={() => toggleFolder(section.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleFolder(section.key);
                    }
                  }}
                >
                  <span className="athql-saved-folder-chevron">
                    {expanded ? <DownOutlined /> : <RightOutlined />}
                  </span>
                  <FolderOutlined className="athql-saved-folder-icon" />
                  <span className="athql-saved-folder-name">{section.label}</span>
                  <span className="athql-saved-folder-count">{section.queries.length}</span>
                </div>
                {expanded && (
                  <div className="athql-saved-folder-body">
                    {section.queries.length === 0 ? (
                      <Typography.Text type="secondary" className="athql-saved-folder-empty">
                        No queries in this folder
                      </Typography.Text>
                    ) : (
                      section.queries.map((query) => (
                        <SavedQueryCard
                          key={query.id}
                          query={query}
                          onOpen={() => loadQuery(query)}
                          onDelete={() => deleteSaved.mutate(query.id)}
                        />
                      ))
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        title="New folder"
        open={folderModalOpen}
        onCancel={() => setFolderModalOpen(false)}
        onOk={() => createFolder.mutate(newFolderName)}
        okButtonProps={{ disabled: !newFolderName.trim() }}
        className="athql-modal"
      >
        <Input
          placeholder="Folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={() => createFolder.mutate(newFolderName)}
        />
      </Modal>
    </div>
  );
}

function SavedQueryCard({
  query,
  onOpen,
  onDelete,
}: {
  query: SavedQuery;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <button type="button" className="athql-history-card athql-saved-card" onClick={onOpen}>
      <div className="athql-history-card-header">
        <span className="athql-saved-name-chip">{query.name}</span>
        <div className="athql-saved-card-actions">
          <span className="athql-history-time">{formatWhen(query.updated_at)}</span>
          <Popconfirm title="Delete this query?" onConfirm={onDelete}>
            <DeleteOutlined className="athql-delete-icon athql-saved-card-delete" onClick={(e) => e.stopPropagation()} />
          </Popconfirm>
        </div>
      </div>

      <pre className="athql-history-sql athql-sql-preview">{query.sql_text.trim()}</pre>

      <div className="athql-history-card-footer athql-saved-card-footer">
        {query.database_context && (
          <span className="athql-history-stats">{query.database_context}</span>
        )}
        {query.tags.length > 0 && (
          <div className="athql-saved-tag-pills">
            {query.tags.map((tag) => (
              <span key={tag} className={`athql-tag-pill athql-tag-pill--${tagPalette(tag)}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function tagPalette(tag: string): (typeof TAG_PALETTE)[number] {
  let hash = 0;
  for (const char of tag) hash = (hash + char.charCodeAt(0)) % TAG_PALETTE.length;
  return TAG_PALETTE[hash];
}

interface SavedSection {
  key: string;
  label: string;
  queries: SavedQuery[];
}

function groupSavedQueries(folders: Folder[], queries: SavedQuery[]): { sections: SavedSection[] } {
  const byFolder = new Map<string, SavedQuery[]>();
  const uncategorized: SavedQuery[] = [];

  for (const query of queries) {
    if (query.folder_id) {
      const list = byFolder.get(query.folder_id) ?? [];
      list.push(query);
      byFolder.set(query.folder_id, list);
    } else {
      uncategorized.push(query);
    }
  }

  const sortQueries = (items: SavedQuery[]) =>
    [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const sections: SavedSection[] = folders.map((folder) => ({
    key: folder.id,
    label: folder.name,
    queries: sortQueries(byFolder.get(folder.id) ?? []),
  }));

  if (uncategorized.length > 0) {
    sections.push({
      key: "uncategorized",
      label: "Uncategorized",
      queries: sortQueries(uncategorized),
    });
  }

  return { sections };
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString();
  } catch {
    return iso;
  }
}
