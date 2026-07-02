import { beforeEach, describe, expect, it } from "vitest";
import {
  loadMatrixRowHeights,
  MATRIX_ROW_HEIGHTS_STORAGE_KEY,
  saveMatrixRowHeights,
} from "./matrix-row-heights.ts";

describe("matrix-row-heights storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips row heights through localStorage", () => {
    saveMatrixRowHeights(new Map([[0, 72], [2, 95]]));
    expect(loadMatrixRowHeights()).toEqual(new Map([[0, 72], [2, 95]]));
    expect(localStorage.getItem(MATRIX_ROW_HEIGHTS_STORAGE_KEY)).toContain('"row":0');
  });

  it("removes storage when row heights map is empty", () => {
    saveMatrixRowHeights(new Map([[1, 64]]));
    saveMatrixRowHeights(new Map());
    expect(loadMatrixRowHeights().size).toBe(0);
    expect(localStorage.getItem(MATRIX_ROW_HEIGHTS_STORAGE_KEY)).toBeNull();
  });

  it("returns an empty map for malformed storage content", () => {
    localStorage.setItem(MATRIX_ROW_HEIGHTS_STORAGE_KEY, "not json");
    expect(loadMatrixRowHeights().size).toBe(0);

    localStorage.setItem(MATRIX_ROW_HEIGHTS_STORAGE_KEY, JSON.stringify({ row: 0, height: 72 }));
    expect(loadMatrixRowHeights().size).toBe(0);
  });

  it("ignores invalid storage entries while clamping valid heights", () => {
    localStorage.setItem(
      MATRIX_ROW_HEIGHTS_STORAGE_KEY,
      JSON.stringify([
        null,
        "tall",
        { row: -1, height: 72 },
        { row: 1.5, height: 72 },
        { row: 2, height: "72" },
        { row: 3, height: 900 },
      ]),
    );

    expect(loadMatrixRowHeights()).toEqual(new Map([[3, 300]]));
  });
});
