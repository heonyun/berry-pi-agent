import { describe, expect, it } from "vitest";
import {
  clearedGridSelection,
  gridSelectionToMatrixSelection,
  matrixSelectionToRangeRef,
  rangeRefToGridSelection,
} from "./matrix-grid-selection.ts";

describe("matrix-grid-selection", () => {
  const range = { startCol: 0, startRow: 0, endCol: 2, endRow: 0 };

  it("round-trips range through GridSelection", () => {
    const gridSel = rangeRefToGridSelection(range);
    const matrixSel = gridSelectionToMatrixSelection(gridSel);
    expect(matrixSel).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 2,
      endRow: 0,
      activeCol: 0,
      activeRow: 0,
    });
    expect(matrixSelectionToRangeRef(matrixSel!)).toEqual(range);
  });

  it("preserves explicit active cell", () => {
    const gridSel = rangeRefToGridSelection(range, { col: 2, row: 0 });
    const matrixSel = gridSelectionToMatrixSelection(gridSel);
    expect(matrixSel?.activeCol).toBe(2);
    expect(matrixSel?.activeRow).toBe(0);
  });

  it("returns null for empty GridSelection", () => {
    expect(gridSelectionToMatrixSelection(clearedGridSelection())).toBeNull();
  });
});
