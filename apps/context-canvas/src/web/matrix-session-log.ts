/** Dev-only ring buffer for manual Matrix testing observability (issue #142). */
// CONTRACT: never persist API keys or full prompts; ring buffer capped at MAX_EVENTS.

export type MatrixSessionEventKind =
  | "shortcut"
  | "run_start"
  | "run_end"
  | "status"
  | "edit_commit"
  | "export"
  | "error";

export interface MatrixSessionEvent {
  readonly ts: string;
  readonly kind: MatrixSessionEventKind;
  readonly detail: Record<string, unknown>;
}

const STORAGE_KEY = "context-matrix-session-log";
const MAX_EVENTS = 300;
const MAX_STRING_LENGTH = 200;

function truncateDetailValue(value: unknown): unknown {
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}…`;
  }
  return value;
}

function sanitizeDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("api_key")) {
      continue;
    }
    sanitized[key] = truncateDetailValue(value);
  }
  return sanitized;
}

/** CONTRACT: on in dev unless VITE_CONTEXT_CANVAS_DEBUG_LOG=0; force on with =1. */
export function isMatrixSessionLogEnabled(): boolean {
  const flag = import.meta.env.VITE_CONTEXT_CANVAS_DEBUG_LOG;
  if (flag === "0") {
    return false;
  }
  if (flag === "1") {
    return true;
  }
  return import.meta.env.DEV === true;
}

export function loadMatrixSessionLog(): MatrixSessionEvent[] {
  if (!isMatrixSessionLogEnabled()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isMatrixSessionEvent);
  } catch {
    return [];
  }
}

function isMatrixSessionEvent(value: unknown): value is MatrixSessionEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    typeof event.ts === "string" &&
    typeof event.kind === "string" &&
    event.detail !== null &&
    typeof event.detail === "object"
  );
}

export function saveMatrixSessionLog(events: readonly MatrixSessionEvent[]): void {
  if (!isMatrixSessionLogEnabled()) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    // session-only fallback
  }
}

export function appendMatrixSessionEvent(
  kind: MatrixSessionEventKind,
  detail: Record<string, unknown> = {},
): void {
  if (!isMatrixSessionLogEnabled()) {
    return;
  }
  const event: MatrixSessionEvent = {
    ts: new Date().toISOString(),
    kind,
    detail: sanitizeDetail(detail),
  };
  saveMatrixSessionLog([event, ...loadMatrixSessionLog()]);
}

export function clearMatrixSessionLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function exportMatrixSessionLogJson(): string {
  return JSON.stringify(loadMatrixSessionLog(), null, 2);
}
