import { describe, expect, it } from "vitest";
import { createEmptyMatrixDocument } from "./domain.ts";
import {
  clampMatrixColumnWidth,
  getMatrixColumnWidth,
  MATRIX_DEFAULT_COLUMN_WIDTH,
  MATRIX_MAX_COLUMN_WIDTH,
  MATRIX_MIN_COLUMN_WIDTH,
} from "./matrix-column-width.ts";

describe("clampMatrixColumnWidth", () => {
  it("clamps to glide resize bounds", () => {
    expect(clampMatrixColumnWidth(10)).toBe(MATRIX_MIN_COLUMN_WIDTH);
    expect(clampMatrixColumnWidth(999)).toBe(MATRIX_MAX_COLUMN_WIDTH);
    expect(clampMatrixColumnWidth(155.4)).toBe(155);
  });
});

describe("getMatrixColumnWidth", () => {
  it("returns default when no override exists", () => {
    const doc = createEmptyMatrixDocument();
    expect(getMatrixColumnWidth(doc, 0)).toBe(MATRIX_DEFAULT_COLUMN_WIDTH);
  });

  it("returns persisted override", () => {
    const doc = {
      ...createEmptyMatrixDocument(),
      columnWidths: new Map([[0, 180]]),
    };
    expect(getMatrixColumnWidth(doc, 0)).toBe(180);
  });
});
