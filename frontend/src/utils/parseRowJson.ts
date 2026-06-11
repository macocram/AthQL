function tryParseJsonString(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function deepParseJsonValues(value: unknown): unknown {
  if (value == null) return null;

  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    if (parsed != null) {
      return deepParseJsonValues(parsed);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepParseJsonValues(item));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepParseJsonValues(nested);
    }
    return out;
  }

  return value;
}

/** Build a row object for JSON view, parsing string fields that contain JSON. */
export function parseRowForJsonView(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "__rowKey") continue;
    out[key] = deepParseJsonValues(value);
  }
  return out;
}

export function formatRowJson(row: Record<string, unknown>): string {
  return JSON.stringify(parseRowForJsonView(row), null, 2);
}
