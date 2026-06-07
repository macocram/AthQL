import { Input, type InputRef } from "antd";
import { useEffect, useRef, useState } from "react";

interface QueryTabLabelProps {
  label: string;
  onRename: (label: string) => void;
}

export function QueryTabLabel({ label, onRename }: QueryTabLabelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    setDraft(label);
  }, [label]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const cancel = () => {
    setDraft(label);
    setEditing(false);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        size="small"
        value={draft}
        className="athql-tab-rename-input"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <span
      className="athql-tab-chip"
      title="Double-click to rename"
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setEditing(true);
      }}
    >
      {label}
    </span>
  );
}
