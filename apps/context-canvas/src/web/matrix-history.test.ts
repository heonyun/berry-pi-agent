// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  appendMatrixHistory,
  createHistoryEntry,
  formatCellCount,
  loadMatrixHistory,
  saveMatrixHistory,
  summarizePatches,
  truncatePreview,
} from "./matrix-history.ts";

describe("matrix-history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates and persists history entries", () => {
    const entry = createHistoryEntry({
      intent: "Summarize inputs",
      contextRanges: [{ label: "@inputs", range: { startRow: 0, startCol: 0, endRow: 4, endCol: 0 } }],
      targetRange: { startRow: 0, startCol: 4, endRow: 4, endCol: 4 },
      targetRangeLabel: "@outputs",
      patchesApplied: 3,
      compiledContextPreview: "preview text",
      patchesSummary: "E1, E2, E3",
    });

    const next = appendMatrixHistory([], entry);
    saveMatrixHistory(next);

    const loaded = loadMatrixHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.intent).toBe("Summarize inputs");
    expect(loaded[0]?.patchesApplied).toBe(3);
    expect(loaded[0]?.contextRangeNames).toEqual(["@inputs"]);
  });

  it("prepends newest entry and caps list size", () => {
    const first = createHistoryEntry({
      intent: "first",
      contextRanges: [],
      targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRangeLabel: "A1",
      patchesApplied: 1,
    });
    const second = createHistoryEntry({
      intent: "second",
      contextRanges: [],
      targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRangeLabel: "A1",
      patchesApplied: 2,
    });

    const entries = appendMatrixHistory(appendMatrixHistory([], first), second);
    expect(entries[0]?.intent).toBe("second");
    expect(entries[1]?.intent).toBe("first");
  });

  it("formats cell count label", () => {
    expect(formatCellCount(1)).toBe("1 cell updated");
    expect(formatCellCount(3)).toBe("3 cells updated");
  });

  it("truncates compiled context preview", () => {
    const long = "x".repeat(300);
    expect(truncatePreview(long, 280)).toHaveLength(281);
    expect(truncatePreview(long, 280).endsWith("…")).toBe(true);
  });

  it("summarizes patch addresses", () => {
    const summary = summarizePatches({
      intent: "test",
      targetRange: { startRow: 0, startCol: 4, endRow: 4, endCol: 4 },
      patches: [
        { row: 0, col: 4, value: "a", body: "a" },
        { row: 1, col: 4, value: "b", body: "b" },
        { row: 2, col: 4, value: "c", body: "c" },
      ],
    });
    expect(summary).toBe("E1, E2, E3");
  });
});
