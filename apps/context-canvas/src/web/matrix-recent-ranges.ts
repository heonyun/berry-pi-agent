import type { RecentRangeEntry } from "../shared/domain.ts";

const STORAGE_KEY = "context-matrix-recent-ranges";
const MAX_RECENT = 12;

export function loadRecentRanges(): RecentRangeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecentRangeEntry);
  } catch {
    return [];
  }
}

export function saveRecentRanges(entries: RecentRangeEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable — session-only fallback is acceptable for Phase 3
  }
}

export function recordRecentRange(
  entries: RecentRangeEntry[],
  entry: Omit<RecentRangeEntry, "lastUsedAt">,
): RecentRangeEntry[] {
  const now = new Date().toISOString();
  const next: RecentRangeEntry = { ...entry, lastUsedAt: now };
  const filtered = entries.filter((e) => e.name !== entry.name);
  return [next, ...filtered].slice(0, MAX_RECENT);
}

function isRecentRangeEntry(value: unknown): value is RecentRangeEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === "string" &&
    typeof entry.rangeLabel === "string" &&
    typeof entry.lastUsedAt === "string"
  );
}
