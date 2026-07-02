import { describe, expect, it } from "vitest";
import { createEmptyMatrixDocument } from "./domain.ts";
import {
  clampMatrixRowHeight,
  getMatrixRowHeight,
  MATRIX_DEFAULT_ROW_HEIGHT,
  MATRIX_MAX_ROW_HEIGHT,
  MATRIX_MIN_ROW_HEIGHT,
} from "./matrix-row-height.ts";

describe("clampMatrixRowHeight", () => {
  it("clamps to matrix row resize bounds", () => {
    expect(clampMatrixRowHeight(10)).toBe(MATRIX_MIN_ROW_HEIGHT);
    expect(clampMatrixRowHeight(999)).toBe(MATRIX_MAX_ROW_HEIGHT);
    expect(clampMatrixRowHeight(72.4)).toBe(72);
  });
});

describe("getMatrixRowHeight", () => {
  it("returns default when no override exists", () => {
    const doc = createEmptyMatrixDocument();
    expect(getMatrixRowHeight(doc, 0)).toBe(MATRIX_DEFAULT_ROW_HEIGHT);
  });

  it("returns persisted override", () => {
    const doc = {
      ...createEmptyMatrixDocument(),
      rowHeights: new Map([[0, 72]]),
    };
    expect(getMatrixRowHeight(doc, 0)).toBe(72);
  });
});
