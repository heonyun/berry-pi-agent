import {
  formatColumnLabel,
  type AiCommand,
  type MatrixHistoryContextRange,
  type MatrixHistoryEntry,
  type RangeRefDTO,
} from "../shared/domain.ts";

const STORAGE_KEY = "context-matrix-history";
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
  readonly compiledContextPreview?: string;
  readonly patchesSummary?: string;
}

export function createHistoryEntry(input: CreateHistoryEntryInput): MatrixHistoryEntry {
  return {
    id: nextHistoryId(),
    timestamp: new Date().toISOString(),
    intent: input.intent,
    contextRangeNames: input.contextRanges.map((range) => range.label),
    contextRanges: input.contextRanges,
    targetRangeLabel: input.targetRangeLabel,
    targetRange: input.targetRange,
    patchesApplied: input.patchesApplied,
    ...(input.compiledContextPreview ? { compiledContextPreview: input.compiledContextPreview } : {}),
    ...(input.patchesSummary ? { patchesSummary: input.patchesSummary } : {}),
  };
}

function isMatrixHistoryEntry(value: unknown): value is MatrixHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.timestamp === "string" &&
    typeof entry.intent === "string" &&
    Array.isArray(entry.contextRangeNames) &&
    Array.isArray(entry.contextRanges) &&
    typeof entry.targetRangeLabel === "string" &&
    typeof entry.targetRange === "object" &&
    typeof entry.patchesApplied === "number"
  );
}
