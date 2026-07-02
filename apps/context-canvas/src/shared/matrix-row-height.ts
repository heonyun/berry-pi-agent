import type { MatrixDocument } from "./domain.ts";

/** INVARIANT: Glide default row height before user resize (#97). */
export const MATRIX_DEFAULT_ROW_HEIGHT = 34;
export const MATRIX_MIN_ROW_HEIGHT = 24;
export const MATRIX_MAX_ROW_HEIGHT = 300;

/** CONTRACT: clamps to Context Matrix row resize bounds. */
export function clampMatrixRowHeight(height: number): number {
  if (!Number.isFinite(height)) {
    return MATRIX_DEFAULT_ROW_HEIGHT;
  }
  return Math.min(
    MATRIX_MAX_ROW_HEIGHT,
    Math.max(MATRIX_MIN_ROW_HEIGHT, Math.round(height)),
  );
}

/** CONTRACT: returns persisted height or default 34. RELATED: issue-97 */
export function getMatrixRowHeight(
  document: Pick<MatrixDocument, "rowHeights">,
  row: number,
): number {
  const stored = document.rowHeights?.get(row);
  if (stored === undefined) {
    return MATRIX_DEFAULT_ROW_HEIGHT;
  }
  return clampMatrixRowHeight(stored);
}
