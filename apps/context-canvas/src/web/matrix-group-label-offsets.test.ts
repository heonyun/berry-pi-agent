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
        [
          "auto:A1:B2",
          {
            id: "auto:A1:B2",
            label: "Group 1",
            source: "auto",
            range: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
            labelOffset: { x: 18, y: -10 },
          },
        ],
        [
          "auto:C1:D2",
          {
            id: "auto:C1:D2",
            label: "Group 2",
            source: "auto",
            range: { startRow: 0, startCol: 2, endRow: 1, endCol: 3 },
          },
        ],
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

  it("removes storage when no groups have label offsets", () => {
    localStorage.setItem(
      MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY,
      JSON.stringify([{ groupId: "auto:A1:B2", x: 18, y: -10 }]),
    );

    saveMatrixGroupLabelOffsets(
      new Map([
        [
          "auto:A1:B2",
          {
            id: "auto:A1:B2",
            label: "Group",
            source: "auto",
            range: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
          },
        ],
      ]),
    );

    expect(localStorage.getItem(MATRIX_GROUP_LABEL_OFFSETS_STORAGE_KEY)).toBeNull();
    expect(loadMatrixGroupLabelOffsets().size).toBe(0);
  });
});
