import { clampMatrixColumnWidth } from "../shared/matrix-column-width.ts";

export const MATRIX_COLUMN_WIDTHS_STORAGE_KEY = "context-matrix-column-widths";

/** CONTRACT: browser-local persist for SPA reload; bundle sidecar is async second persist (#96). */
export function loadMatrixColumnWidths(): ReadonlyMap<number, number> {
  try {
    const raw = localStorage.getItem(MATRIX_COLUMN_WIDTHS_STORAGE_KEY);
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
        Number.isInteger((entry as { col?: number }).col) &&
        typeof (entry as { width?: number }).width === "number"
      ) {
        const col = (entry as { col: number }).col;
        const width = clampMatrixColumnWidth((entry as { width: number }).width);
        next.set(col, width);
      }
    }
    return next;
  } catch {
    return new Map();
  }
}

export function saveMatrixColumnWidths(widths: ReadonlyMap<number, number> | undefined): void {
  try {
    const entries = [...(widths ?? new Map()).entries()]
      .filter(([, width]) => Number.isFinite(width))
      .map(([col, width]) => ({ col, width: clampMatrixColumnWidth(width) }))
      .sort((a, b) => a.col - b.col);
    if (entries.length === 0) {
      localStorage.removeItem(MATRIX_COLUMN_WIDTHS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(MATRIX_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}
