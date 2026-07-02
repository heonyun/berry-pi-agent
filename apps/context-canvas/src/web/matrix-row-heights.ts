import { clampMatrixRowHeight } from "../shared/matrix-row-height.ts";

export const MATRIX_ROW_HEIGHTS_STORAGE_KEY = "context-matrix-row-heights";

/** CONTRACT: browser-local persist for SPA reload; bundle sidecar is async second persist (#97). */
export function loadMatrixRowHeights(): ReadonlyMap<number, number> {
  try {
    const raw = localStorage.getItem(MATRIX_ROW_HEIGHTS_STORAGE_KEY);
    if (!raw) {
      return new Map();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Map();
    }
    const next = new Map<number, number>();
    for (const entry of parsed) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        Number.isInteger((entry as { row?: number }).row) &&
        Number((entry as { row?: number }).row) >= 0 &&
        typeof (entry as { height?: number }).height === "number"
      ) {
        const row = (entry as { row: number }).row;
        const height = clampMatrixRowHeight((entry as { height: number }).height);
        next.set(row, height);
      }
    }
    return next;
  } catch {
    return new Map();
  }
}

export function saveMatrixRowHeights(heights: ReadonlyMap<number, number> | undefined): void {
  try {
    const entries = [...(heights ?? new Map()).entries()]
      .filter(([row, height]) => row >= 0 && Number.isFinite(height))
      .map(([row, height]) => ({ row, height: clampMatrixRowHeight(height) }))
      .sort((a, b) => a.row - b.row);
    if (entries.length === 0) {
      localStorage.removeItem(MATRIX_ROW_HEIGHTS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(MATRIX_ROW_HEIGHTS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}
