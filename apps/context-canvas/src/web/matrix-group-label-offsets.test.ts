// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  loadMatrixGroupLabelOffsets,
  MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY,
  saveMatrixGroupLabelOffsets,
} from "./matrix-group-label-offsets.ts";

describe("matrix-group-label-offsets", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips group label offsets", () => {
    saveMatrixGroupLabelOffsets(
      new Map([
        ["auto:A1:B2", { labelOffset: { x: 18, y: -10 } }],
        ["auto:C1:D2", {}],
      ]),
    );

    expect(JSON.parse(localStorage.getItem(MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY) ?? "[]")).toEqual([
      { groupId: "auto:A1:B2", x: 18, y: -10 },
    ]);
    expect(loadMatrixGroupLabelOffsets().get("auto:A1:B2")).toEqual({ x: 18, y: -10 });
  });

  it("ignores malformed storage", () => {
    localStorage.setItem(MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY, "{");

    expect(loadMatrixGroupLabelOffsets().size).toBe(0);
  });
});
