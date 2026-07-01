import { CompactSelection } from "@glideapps/glide-data-grid";
import { describe, expect, it } from "vitest";
import {
  clearedGridSelection,
  gridSelectionToMatrixSelection,
  matrixSelectionToRangeRef,
  rangeRefToGridSelection,
} from "./matrix-grid-selection.ts";

const sheetBounds = { rows: 20, cols: 50 };

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

  it("maps a selected row to a full-row range", () => {
    const gridSel: ReturnType<typeof clearedGridSelection> = {
      ...clearedGridSelection(),
      rows: CompactSelection.fromSingleSelection(1),
    };
    const matrixSel = gridSelectionToMatrixSelection(gridSel, sheetBounds);
    expect(matrixSel).toEqual({
      startCol: 0,
      startRow: 1,
      endCol: 49,
      endRow: 1,
      activeCol: 0,
      activeRow: 1,
    });
  });

  it("maps a selected column to a full-column range", () => {
    const gridSel: ReturnType<typeof clearedGridSelection> = {
      ...clearedGridSelection(),
      columns: CompactSelection.fromSingleSelection(1),
    };
    const matrixSel = gridSelectionToMatrixSelection(gridSel, sheetBounds);
    expect(matrixSel).toEqual({
      startCol: 1,
      startRow: 0,
      endCol: 1,
      endRow: 19,
      activeCol: 1,
      activeRow: 0,
    });
  });
});
