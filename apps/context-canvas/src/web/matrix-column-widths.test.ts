import { beforeEach, describe, expect, it } from "vitest";
import {
  loadMatrixColumnWidths,
  MATRIX_COLUMN_WIDTHS_STORAGE_KEY,
  saveMatrixColumnWidths,
} from "./matrix-column-widths.ts";

describe("matrix-column-widths storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips column widths through localStorage", () => {
    saveMatrixColumnWidths(new Map([[0, 180], [2, 95]]));
    expect(loadMatrixColumnWidths()).toEqual(new Map([[0, 180], [2, 95]]));
    expect(localStorage.getItem(MATRIX_COLUMN_WIDTHS_STORAGE_KEY)).toContain('"col":0');
  });

  it("removes storage when widths map is empty", () => {
    saveMatrixColumnWidths(new Map([[1, 140]]));
    saveMatrixColumnWidths(new Map());
    expect(loadMatrixColumnWidths().size).toBe(0);
    expect(localStorage.getItem(MATRIX_COLUMN_WIDTHS_STORAGE_KEY)).toBeNull();
  });

  it("returns an empty map for malformed storage content", () => {
    localStorage.setItem(MATRIX_COLUMN_WIDTHS_STORAGE_KEY, "not json");
    expect(loadMatrixColumnWidths().size).toBe(0);

    localStorage.setItem(MATRIX_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify({ col: 0, width: 120 }));
    expect(loadMatrixColumnWidths().size).toBe(0);
  });

  it("ignores invalid storage entries while clamping valid widths", () => {
    localStorage.setItem(
      MATRIX_COLUMN_WIDTHS_STORAGE_KEY,
      JSON.stringify([
        null,
        "wide",
        { col: 1.5, width: 120 },
        { col: 2, width: "120" },
        { col: 3, width: 900 },
      ]),
    );

    expect(loadMatrixColumnWidths()).toEqual(new Map([[3, 500]]));
  });
});
