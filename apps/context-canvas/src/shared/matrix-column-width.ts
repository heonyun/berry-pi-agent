import type { MatrixDocument } from "./domain.ts";

/** INVARIANT: Glide default column width before user resize (#96). */
export const MATRIX_DEFAULT_COLUMN_WIDTH = 120;
export const MATRIX_MIN_COLUMN_WIDTH = 50;
export const MATRIX_MAX_COLUMN_WIDTH = 500;

/** CONTRACT: clamps to Glide min/max column resize bounds. */
export function clampMatrixColumnWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return MATRIX_DEFAULT_COLUMN_WIDTH;
  }
  return Math.min(
    MATRIX_MAX_COLUMN_WIDTH,
    Math.max(MATRIX_MIN_COLUMN_WIDTH, Math.round(width)),
  );
}

/** CONTRACT: returns persisted width or default 120. RELATED: issue-96 */
export function getMatrixColumnWidth(
  document: Pick<MatrixDocument, "columnWidths">,
  col: number,
): number {
  const stored = document.columnWidths?.get(col);
  if (stored === undefined) {
    return MATRIX_DEFAULT_COLUMN_WIDTH;
  }
  return clampMatrixColumnWidth(stored);
}
