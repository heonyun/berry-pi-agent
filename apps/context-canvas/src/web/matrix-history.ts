import {
  cellKey,
  createEmptyMatrixDocument,
  formatColumnLabel,
  MATRIX_SNAPSHOT_MAX_BYTES,
  type AiCommand,
  type Cell,
  type MatrixDocument,
  type MatrixHistoryContextRange,
  type MatrixHistoryEntry,
  type MatrixHistoryOutcome,
  type MatrixHistorySnapshot,
  type MatrixRunTrigger,
  type RangeRefDTO,
} from "../shared/domain.ts";
import { isMatrixHistoryEntry } from "../shared/matrix-validation.ts";

/** Build a serializable document snapshot from the current MatrixDocument state.
  * Cells are serialized as an array of {row, col, Cell} pairs (Map is not JSON-safe).
  * Groups are serialized as an array preserving id, label, range, source, and optional fields.
  * Size metadata documents the configured byte limit and the observed serialized size. */
export function createMatrixHistorySnapshot(document: MatrixDocument): MatrixHistorySnapshot {
  const cells: Array<{ row: number; col: number; cell: Cell }> = [];
  for (const [key, cell] of document.sheet.cells) {
    const parts = key.split(",");
    const row = Number(parts[0]);
    const col = Number(parts[1]);
    if (parts.length !== 2 || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) {
      // WHY: Invalid map keys should not poison the whole persisted history entry.
      continue;
    }
    cells.push({ row, col, cell });
  }

  const groups: MatrixHistorySnapshot["groups"] = Array.from(document.groups.values()).map((group) => ({
    id: group.id,
    label: group.label,
    range: group.range,
    source: group.source,
    ...(group.labelOffset ? { labelOffset: group.labelOffset } : {}),
    ...(group.dismissed !== undefined ? { dismissed: group.dismissed } : {}),
  }));

  // WHY: Measure the full snapshot first so oversized payloads can drop cells before storage.
  const snapshot = {
    // schemaVersion typed as literal 1 for MatrixHistorySnapshot
    schemaVersion: 1 as const,
    sheet: {
      id: document.sheet.id,
      name: document.sheet.name,
      rows: document.sheet.rows,
      cols: document.sheet.cols,
    },
    cells,
    groups,
    maxSerializedBytes: MATRIX_SNAPSHOT_MAX_BYTES,
  };

  const serialized = JSON.stringify(snapshot);
  const serializedBytes = new TextEncoder().encode(serialized).length;

  if (serializedBytes > MATRIX_SNAPSHOT_MAX_BYTES) {
    // WHY: Preserve structural metadata while preventing runaway localStorage writes.
    const prunedSnapshot = {
      ...snapshot,
      cells: [],
    };
    const prunedSerialized = JSON.stringify(prunedSnapshot);
    const prunedSerializedBytes = new TextEncoder().encode(prunedSerialized).length;

    return {
      ...prunedSnapshot,
      serializedBytes: prunedSerializedBytes,
      truncated: true,
    };
  }

  return {
    ...snapshot,
    serializedBytes,
    truncated: false,
  };
}

export function createMatrixDocumentFromHistorySnapshot(
  snapshot: MatrixHistorySnapshot,
  baseDocument: MatrixDocument = createEmptyMatrixDocument({ withResearchTemplate: false }),
): MatrixDocument {
  // CONTRACT: history snapshots restore persisted sheet content; view-only document state stays with baseDocument.
  const cells = new Map(
    snapshot.cells.map((entry) => [cellKey(entry.row, entry.col), entry.cell] as const),
  );
  const groups = new Map(snapshot.groups.map((group) => [group.id, group] as const));

  return {
    ...baseDocument,
    sheet: {
      ...baseDocument.sheet,
      id: snapshot.sheet.id,
      name: snapshot.sheet.name,
      rows: snapshot.sheet.rows,
      cols: snapshot.sheet.cols,
      cells,
    },
    groups,
  };
}

const STORAGE_KEY = "context-matrix-history";
/**
 * CONTRACT: localStorage is authoritative for in-browser history;
 * bundle export is async second persist (see scheduleMatrixBundleExport).
 */
const MAX_HISTORY = 50;
const PREVIEW_MAX = 280;

export function loadMatrixHistory(): MatrixHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isMatrixHistoryEntry);
  } catch {
    return [];
  }
}

export function saveMatrixHistory(entries: MatrixHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage unavailable — session-only fallback
  }
}

export function appendMatrixHistory(
  entries: MatrixHistoryEntry[],
  entry: MatrixHistoryEntry,
): MatrixHistoryEntry[] {
  return [entry, ...entries].slice(0, MAX_HISTORY);
}

export function nextHistoryId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function truncatePreview(text: string, maxLength = PREVIEW_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

export function summarizePatches(command: AiCommand): string {
  if (command.patches.length === 0) {
    return "No patches applied";
  }
  const addresses = command.patches.map(
    (patch) => `${formatColumnLabel(patch.col)}${patch.row + 1}`,
  );
  if (addresses.length <= 5) {
    return addresses.join(", ");
  }
  return `${addresses.slice(0, 3).join(", ")} +${addresses.length - 3} more`;
}

export function formatHistoryTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCellCount(count: number): string {
  return count === 1 ? "1 cell updated" : `${count} cells updated`;
}

export interface CreateHistoryEntryInput {
  readonly intent: string;
  readonly contextRanges: readonly MatrixHistoryContextRange[];
  readonly targetRange: RangeRefDTO;
  readonly targetRangeLabel: string;
  readonly patchesApplied: number;
  readonly outcome?: MatrixHistoryOutcome;
  readonly errorMessage?: string;
  readonly trigger?: MatrixRunTrigger;
  readonly snapshot?: MatrixHistorySnapshot;
  readonly compiledContextPreview?: string;
  readonly patchesSummary?: string;
}

export function createHistoryEntry(input: CreateHistoryEntryInput): MatrixHistoryEntry {
  const outcome = input.outcome ?? "success";
  return {
    id: nextHistoryId(),
    timestamp: new Date().toISOString(),
    intent: input.intent,
    contextRangeNames: input.contextRanges.map((range) => range.label),
    contextRanges: input.contextRanges,
    targetRangeLabel: input.targetRangeLabel,
    targetRange: input.targetRange,
    patchesApplied: input.patchesApplied,
    outcome,
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
    ...(input.trigger ? { trigger: input.trigger } : {}),
    ...(input.snapshot ? { snapshot: input.snapshot } : {}),
    ...(input.compiledContextPreview ? { compiledContextPreview: input.compiledContextPreview } : {}),
    ...(input.patchesSummary ? { patchesSummary: input.patchesSummary } : {}),
  };
}

export function formatHistoryOutcome(entry: MatrixHistoryEntry): string {
  const outcome = entry.outcome ?? "success";
  if (outcome === "success") {
    return formatCellCount(entry.patchesApplied);
  }
  if (outcome === "failure") {
    return `failed${entry.errorMessage ? `: ${entry.errorMessage}` : ""}`;
  }
  return `blocked${entry.errorMessage ? `: ${entry.errorMessage}` : ""}`;
}
