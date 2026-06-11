import { useMemo, useState } from "react";

interface JsonTreeViewerProps {
  value: unknown;
  name?: string;
  depth?: number;
  defaultExpanded?: boolean;
}

function valuePreview(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    const compact = value.length > 80 ? `${value.slice(0, 80)}…` : value;
    return `"${compact}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") return `Object(${Object.keys(value as object).length})`;
  return String(value);
}

function isExpandable(value: unknown): value is Record<string, unknown> | unknown[] {
  return (Array.isArray(value) && value.length > 0) || (!!value && typeof value === "object" && Object.keys(value).length > 0);
}

export function JsonTreeViewer({
  value,
  name,
  depth = 0,
  defaultExpanded = depth < 1,
}: JsonTreeViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const expandable = isExpandable(value);

  const entries = useMemo(() => {
    if (Array.isArray(value)) {
      return value.map((item, index) => ({ key: String(index), val: item }));
    }
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).map(([key, val]) => ({ key, val }));
    }
    return [];
  }, [value]);

  if (!expandable) {
    return (
      <div className="athql-json-leaf" style={{ paddingLeft: depth * 16 }}>
        {name != null && <span className="athql-json-key">{name}: </span>}
        <span className={`athql-json-value athql-json-value--${value === null ? "null" : typeof value}`}>
          {valuePreview(value)}
        </span>
      </div>
    );
  }

  const open = expanded;
  const bracketOpen = Array.isArray(value) ? "[" : "{";
  const bracketClose = Array.isArray(value) ? "]" : "}";

  return (
    <div className="athql-json-node">
      <button
        type="button"
        className="athql-json-toggle"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={open}
      >
        <span className="athql-json-chevron">{open ? "▾" : "▸"}</span>
        {name != null && <span className="athql-json-key">{name}: </span>}
        <span className="athql-json-bracket">{bracketOpen}</span>
        {!open && (
          <>
            <span className="athql-json-preview">{valuePreview(value)}</span>
            <span className="athql-json-bracket">{bracketClose}</span>
          </>
        )}
      </button>
      {open && (
        <div className="athql-json-children">
          {entries.map(({ key, val }) => (
            <JsonTreeViewer key={key} name={key} value={val} depth={depth + 1} defaultExpanded={depth < 1} />
          ))}
          <div className="athql-json-close" style={{ paddingLeft: depth * 16 }}>
            <span className="athql-json-bracket">{bracketClose}</span>
          </div>
        </div>
      )}
    </div>
  );
}
