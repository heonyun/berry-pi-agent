import type { RangeRefDTO } from "./domain.ts";

export type MatrixTargetDirection = "below" | "right";

export type MatrixTargetInferenceResult =
  | { ok: true; targetRange: RangeRefDTO }
  | { ok: false; reason: "no-room-below" | "no-room-right" };

export function inferMatrixTargetRange(
  selection: RangeRefDTO,
  direction: MatrixTargetDirection,
  bounds: { readonly rows: number; readonly cols: number },
): MatrixTargetInferenceResult {
  const width = selection.endCol - selection.startCol + 1;
  const height = selection.endRow - selection.startRow + 1;

  if (direction === "below") {
    const startRow = selection.endRow + 1;
    const endRow = startRow + height - 1;
    if (endRow >= bounds.rows) {
      return { ok: false, reason: "no-room-below" };
    }
    return {
      ok: true,
      targetRange: {
        startRow,
        endRow,
        startCol: selection.startCol,
        endCol: selection.endCol,
      },
    };
  }

  const startCol = selection.endCol + 1;
  const endCol = startCol + width - 1;
  if (endCol >= bounds.cols) {
    return { ok: false, reason: "no-room-right" };
  }
  return {
    ok: true,
    targetRange: {
      startRow: selection.startRow,
      endRow: selection.endRow,
      startCol,
      endCol,
    },
  };
}
