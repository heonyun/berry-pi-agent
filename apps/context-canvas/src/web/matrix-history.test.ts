// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  appendMatrixHistory,
  createHistoryEntry,
  createMatrixHistorySnapshot,
  formatCellCount,
  loadMatrixHistory,
  saveMatrixHistory,
  summarizePatches,
  truncatePreview,
} from "./matrix-history.ts";
import { createEmptyMatrixDocument, type Cell, type MatrixGroup } from "../shared/domain.ts";

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

  it("preserves stable group ids for history reruns", () => {
    const entry = createHistoryEntry({
      intent: "Summarize group",
      contextRanges: [
        {
          label: "Research",
          range: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
          groupId: "auto:group-1",
        },
      ],
      targetRange: { startRow: 0, startCol: 2, endRow: 1, endCol: 2 },
      targetRangeLabel: "C1:C2",
      patchesApplied: 2,
    });

    saveMatrixHistory([entry]);

    const loaded = loadMatrixHistory();
    expect(loaded[0]?.contextRanges[0]?.groupId).toBe("auto:group-1");
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

  it("trims history to MAX_HISTORY entries", () => {
    let entries: ReturnType<typeof createHistoryEntry>[] = [];
    for (let i = 0; i < 55; i++) {
      entries = appendMatrixHistory(
        entries,
        createHistoryEntry({
          intent: `run-${i}`,
          contextRanges: [],
          targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
          targetRangeLabel: "A1",
          patchesApplied: 1,
        }),
      );
    }
    expect(entries).toHaveLength(50);
    expect(entries[0]?.intent).toBe("run-54");
    expect(entries[49]?.intent).toBe("run-5");
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


describe("createMatrixHistorySnapshot", () => {
  it("serializes cells from a MatrixDocument as an array of row/col/cell", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    (doc.sheet.cells as Map<string, import("../shared/domain.ts").Cell>).set("0,0", { value: "A1", body: "Cell A1", frontmatter: "", provenance: "user" });
    (doc.sheet.cells as Map<string, import("../shared/domain.ts").Cell>).set("2,3", { value: 42, body: "D3", frontmatter: "tags: [test]", provenance: "ai" });
    const snapshot = createMatrixHistorySnapshot(doc);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.cells).toHaveLength(2);
    const c0 = snapshot.cells.find(c => c.row === 0 && c.col === 0);
    expect(c0).toBeDefined();
    expect(c0?.cell.value).toBe("A1");
    const c1 = snapshot.cells.find(c => c.row === 2 && c.col === 3);
    expect(c1).toBeDefined();
    expect(c1?.cell.value).toBe(42);
    expect(c1?.cell.frontmatter).toBe("tags: [test]");
  });

  it("serializes groups preserving id, label, range, source, and optional fields", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    (doc.groups as Map<string, import("../shared/domain.ts").MatrixGroup>).set("g1", { id: "g1", label: "Group A", range: { startRow: 0, startCol: 0, endRow: 2, endCol: 3 }, source: "auto" });
    (doc.groups as Map<string, import("../shared/domain.ts").MatrixGroup>).set("g2", { id: "g2", label: "Group B", range: { startRow: 3, startCol: 0, endRow: 5, endCol: 1 }, source: "auto", labelOffset: { x: 10, y: 20 }, dismissed: false });
    const snapshot = createMatrixHistorySnapshot(doc);
    expect(snapshot.groups).toHaveLength(2);
    const g1 = snapshot.groups.find(g => g.id === "g1");
    expect(g1?.label).toBe("Group A");
    expect(g1?.range.endCol).toBe(3);
    const g2 = snapshot.groups.find(g => g.id === "g2");
    expect(g2?.labelOffset).toEqual({ x: 10, y: 20 });
    expect(g2?.dismissed).toBe(false);
  });

  it("includes size metadata fields", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    (doc.sheet.cells as Map<string, import("../shared/domain.ts").Cell>).set("0,0", { value: "test", body: "test", frontmatter: "", provenance: "user" });
    const snapshot = createMatrixHistorySnapshot(doc);
    expect(typeof snapshot.maxSerializedBytes).toBe("number");
    expect(snapshot.maxSerializedBytes).toBeGreaterThan(0);
    expect(typeof snapshot.serializedBytes).toBe("number");
    expect(snapshot.serializedBytes).toBeGreaterThan(0);
    expect(typeof snapshot.truncated).toBe("boolean");
    expect(snapshot.truncated).toBe(false);
  });

  it("prunes cells when serialized size exceeds MATRIX_SNAPSHOT_MAX_BYTES", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    // WHY: Oversized snapshots must shrink before localStorage persistence, not only report metadata.
    const bigBody = "x".repeat(50000);
    const cells = doc.sheet.cells as Map<string, Cell>;
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 10; j++) {
        cells.set(`${i},${j}`, {
          value: bigBody,
          body: bigBody,
          frontmatter: "tags: [test]",
          provenance: "ai",
        });
      }
    }
    (doc.groups as Map<string, MatrixGroup>).set("g1", {
      id: "g1",
      label: "Persistent Group",
      range: { startRow: 0, startCol: 0, endRow: 2, endCol: 3 },
      source: "auto",
    });

    const snapshot = createMatrixHistorySnapshot(doc);

    expect(snapshot.truncated).toBe(true);
    expect(snapshot.cells).toHaveLength(0);
    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0]?.id).toBe("g1");
    expect(snapshot.sheet.id).toBe(doc.sheet.id);
    expect(snapshot.serializedBytes).toBeLessThanOrEqual(snapshot.maxSerializedBytes);
  });

  it("preserves sheet metadata in snapshot", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    const snapshot = createMatrixHistorySnapshot(doc);
    expect(snapshot.sheet.id).toBe(doc.sheet.id);
    expect(snapshot.sheet.name).toBe(doc.sheet.name);
    expect(snapshot.sheet.rows).toBe(doc.sheet.rows);
    expect(snapshot.sheet.cols).toBe(doc.sheet.cols);
  });
});

describe("saveMatrixHistory / loadMatrixHistory with snapshots", () => {
  it("preserves snapshot through browser localStorage round-trip", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    (doc.sheet.cells as Map<string, import("../shared/domain.ts").Cell>).set("0,0", { value: "A1", body: "Cell A1", frontmatter: "", provenance: "user" });
    const snapshot = createMatrixHistorySnapshot(doc);
    const entry = createHistoryEntry({
      intent: "Test with snapshot",
      contextRanges: [],
      targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRangeLabel: "A1",
      patchesApplied: 0,
      snapshot,
    });
    saveMatrixHistory([entry]);
    const loaded = loadMatrixHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.snapshot).toBeDefined();
    expect(loaded[0]?.snapshot?.schemaVersion).toBe(1);
    expect(loaded[0]?.snapshot?.cells).toHaveLength(1);
    expect(loaded[0]?.snapshot?.cells[0]?.cell.value).toBe("A1");
  });

  it("round-trips history entry without snapshot", () => {
    const entry = createHistoryEntry({
      intent: "No snapshot",
      contextRanges: [],
      targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRangeLabel: "A1",
      patchesApplied: 0,
    });
    saveMatrixHistory([entry]);
    const loaded = loadMatrixHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.snapshot).toBeUndefined();
  });
});
