// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  bindAiCommandToUserTarget,
  coerceAiCommandPayload,
  filterPatchesToTargetRange,
  isMatrixHistoryEntry,
  parseAiCommand,
  relocatePatchesToUserTarget,
  validateWritePatches,
  WritePatchSchema,
  AiCommandSchema,
} from "./matrix-validation.ts";

describe("matrix-validation", () => {
  describe("WritePatchSchema", () => {
    it("accepts a valid write patch with all fields", () => {
      const result = WritePatchSchema.safeParse({
        row: 0,
        col: 0,
        value: "test",
        body: "Hello",
        frontmatter: "tags: [demo]",
        provenance: "ai-v1",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a minimal write patch (no frontmatter, no provenance)", () => {
      const result = WritePatchSchema.safeParse({
        row: 5,
        col: 10,
        value: 42,
        body: "Number value",
      });
      expect(result.success).toBe(true);
    });

    it("accepts boolean and null values", () => {
      expect(WritePatchSchema.safeParse({ row: 1, col: 1, value: true, body: "flag" }).success).toBe(true);
      expect(WritePatchSchema.safeParse({ row: 1, col: 2, value: null, body: "empty" }).success).toBe(true);
    });

    it("rejects negative row/col", () => {
      expect(WritePatchSchema.safeParse({ row: -1, col: 0, value: "x", body: "x" }).success).toBe(false);
      expect(WritePatchSchema.safeParse({ row: 0, col: -1, value: "x", body: "x" }).success).toBe(false);
    });

    it("rejects non-integer row/col", () => {
      expect(WritePatchSchema.safeParse({ row: 1.5, col: 0, value: "x", body: "x" }).success).toBe(false);
      expect(WritePatchSchema.safeParse({ row: 0, col: "a", value: "x", body: "x" }).success).toBe(false);
    });

    it("rejects missing required fields", () => {
      expect(WritePatchSchema.safeParse({ row: 0 }).success).toBe(false);
      expect(WritePatchSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("AiCommandSchema", () => {
    it("accepts a valid AI command with patches", () => {
      const result = AiCommandSchema.safeParse({
        intent: "Fill status values",
        targetRange: { startRow: 0, startCol: 0, endRow: 5, endCol: 5 },
        patches: [
          { row: 1, col: 1, value: "done", body: "Completed" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts an AI command with empty patches array", () => {
      const result = AiCommandSchema.safeParse({
        intent: "No-op",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patches: [],
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing intent", () => {
      const result = AiCommandSchema.safeParse({
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patches: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty intent string", () => {
      const result = AiCommandSchema.safeParse({
        intent: "",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patches: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative endRow/endCol", () => {
      const result = AiCommandSchema.safeParse({
        intent: "test",
        targetRange: { startRow: 0, startCol: 0, endRow: -1, endCol: 0 },
        patches: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("parseAiCommand", () => {
    it("returns ok:true for valid payload", () => {
      const result = parseAiCommand({
        intent: "Test",
        targetRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
        patches: [{ row: 0, col: 0, value: "a", body: "A" }],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.command.intent).toBe("Test");
        expect(result.command.patches).toHaveLength(1);
      }
    });

    it("returns ok:false for invalid payload", () => {
      const result = parseAiCommand({ intent: 123 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toBeDefined();
      }
    });

    it("returns ok:false for null input", () => {
      const result = parseAiCommand(null);
      expect(result.ok).toBe(false);
    });

    it("unwraps a nested command envelope from the model", () => {
      const result = parseAiCommand({
        command: {
          intent: "Fill status",
          targetRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
          patches: [],
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.command.intent).toBe("Fill status");
      }
    });
  });

  describe("coerceAiCommandPayload", () => {
    const bare = {
      intent: "x",
      targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      patches: [],
    };

    it("returns bare AiCommand payloads unchanged", () => {
      expect(coerceAiCommandPayload(bare)).toEqual(bare);
    });

    it("unwraps nested command envelopes", () => {
      expect(coerceAiCommandPayload({ command: bare })).toEqual(bare);
    });
  });

  describe("filterPatchesToTargetRange", () => {
    it("keeps patches inside targetRange and strips others", () => {
      const targetRange = { startRow: 1, startCol: 4, endRow: 2, endCol: 4 };
      const { patches, strippedCount } = filterPatchesToTargetRange(
        [
          { row: 1, col: 4, value: "ok", body: "in target" },
          { row: 0, col: 0, value: "bad", body: "outside" },
          { row: 3, col: 4, value: "bad2", body: "also outside" },
        ],
        targetRange,
      );

      expect(patches).toHaveLength(1);
      expect(patches[0]?.body).toBe("in target");
      expect(strippedCount).toBe(2);
    });
  });

  describe("relocatePatchesToUserTarget", () => {
    it("maps model B2 patch to user A1 when model target is B2", () => {
      const modelTarget = { startRow: 1, startCol: 1, endRow: 1, endCol: 1 };
      const userTarget = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
      const relocated = relocatePatchesToUserTarget(
        [{ row: 1, col: 1, value: "x", body: "summarized" }],
        modelTarget,
        userTarget,
      );
      expect(relocated[0]).toMatchObject({ row: 0, col: 0, body: "summarized" });
    });
  });

  describe("bindAiCommandToUserTarget", () => {
    it("replaces model targetRange with user selection and relocates drifted patches", () => {
      const userTarget = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
      const modelCommand = {
        intent: "Summarize",
        targetRange: { startRow: 1, startCol: 1, endRow: 1, endCol: 1 },
        patches: [
          { row: 1, col: 1, value: "wrong cell", body: "wrong cell" },
          { row: 0, col: 0, value: "right cell", body: "right cell" },
        ],
      };

      const bound = bindAiCommandToUserTarget(modelCommand, userTarget);

      expect(bound.command.targetRange).toEqual(userTarget);
      expect(bound.command.patches).toHaveLength(1);
      expect(bound.command.patches[0]).toMatchObject({ row: 0, col: 0, body: "wrong cell" });
      expect(bound.strippedCount).toBe(1);
    });

    it("keeps history label and stored range aligned for A1 target", () => {
      const userTarget = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
      const modelCommand = {
        intent: "Fill",
        targetRange: { startRow: 1, startCol: 1, endRow: 1, endCol: 1 },
        patches: [{ row: 1, col: 1, value: "x", body: "x" }],
      };

      const bound = bindAiCommandToUserTarget(modelCommand, userTarget);

      expect(bound.command.targetRange).toEqual(userTarget);
      expect(bound.command.patches).toHaveLength(1);
      expect(bound.command.patches[0]).toMatchObject({ row: 0, col: 0, body: "x" });
      expect(bound.strippedCount).toBe(0);
    });
  });

  describe("validateWritePatches", () => {
    it("validates an array of valid patches", () => {
      const result = validateWritePatches([
        { row: 0, col: 0, value: "a", body: "A" },
        { row: 1, col: 1, value: "b", body: "B" },
      ]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patches).toHaveLength(2);
      }
    });

    it("returns errors with indices for invalid patches", () => {
      const result = validateWritePatches([
        { row: 0, col: 0, value: "a", body: "A" },
        { row: -1, col: 0, value: "b", body: "B" },
        { row: 2, col: "x", value: "c", body: "C" },
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
        // Should report index 1 and 2 as errors
        const indexes = result.errors.map((e) => e.index);
        expect(indexes).toContain(1);
        expect(indexes).toContain(2);
      }
    });

    it("returns ok:true for empty array", () => {
      const result = validateWritePatches([]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patches).toEqual([]);
      }
    });
  });

  describe("MatrixHistorySnapshot validation", () => {
    const validSnapshot = {
      schemaVersion: 1,
      sheet: { id: "sheet-1", name: "Test", rows: 20, cols: 50 },
      cells: [
        { row: 0, col: 0, cell: { value: "A1", body: "Cell A1", frontmatter: "", provenance: "user" } },
        { row: 1, col: 2, cell: { value: "C2", body: "Cell C2", frontmatter: "", provenance: "ai" } },
      ],
      groups: [
        { id: "g1", label: "Group 1", range: { startRow: 0, startCol: 0, endRow: 1, endCol: 2 }, source: "auto" },
      ],
      maxSerializedBytes: 1000000,
      serializedBytes: 512,
      truncated: false,
    };

    it("accepts a fully valid snapshot on a history entry", () => {
      const entry = {
        id: "h1",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: validSnapshot,
      };
      expect(isMatrixHistoryEntry(entry)).toBe(true);
    });

    it("rejects a history entry with a malformed snapshot (wrong schemaVersion)", () => {
      const entry = {
        id: "h2",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: { ...validSnapshot, schemaVersion: 999 },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects a history entry with a malformed snapshot (missing cells)", () => {
      const entry = {
        id: "h3",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: { schemaVersion: 1, sheet: { id: "s", name: "n", rows: 1, cols: 1 }, groups: [], maxSerializedBytes: 100, serializedBytes: 0, truncated: false },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("accepts a history entry without a snapshot", () => {
      const entry = {
        id: "h4",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
      };
      expect(isMatrixHistoryEntry(entry)).toBe(true);
    });

    it("rejects malformed nested cell with non-integer row", () => {
      const entry = {
        id: "h5",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: 1 },
          cells: [{ row: 0.5, col: 0, cell: { value: "x", body: "x", frontmatter: "" } }],
          groups: [],
          maxSerializedBytes: 100, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects malformed nested cell with bad value type", () => {
      const entry = {
        id: "h6",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: 1 },
          cells: [{ row: 0, col: 0, cell: { value: {}, body: "x", frontmatter: "" } }],
          groups: [],
          maxSerializedBytes: 100, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects malformed group with wrong source", () => {
      const entry = {
        id: "h7",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: 1 },
          cells: [],
          groups: [{ id: "g1", label: "G", range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, source: "manual" }],
          maxSerializedBytes: 100, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects malformed group with bad range", () => {
      const entry = {
        id: "h8",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: 1 },
          cells: [],
          groups: [{ id: "g1", label: "G", range: { startRow: -1, startCol: 0, endRow: 0, endCol: 0 }, source: "auto" }],
          maxSerializedBytes: 100, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects malformed group with bad labelOffset", () => {
      const entry = {
        id: "h9",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: 1 },
          cells: [],
          groups: [{ id: "g1", label: "G", range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, source: "auto", labelOffset: { x: NaN, y: 0 } }],
          maxSerializedBytes: 100, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects snapshot with non-integer sheet rows", () => {
      const entry = {
        id: "h10",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1.5, cols: 1 },
          cells: [],
          groups: [],
          maxSerializedBytes: 100, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects snapshot with negative sheet cols", () => {
      const entry = {
        id: "h11",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: -1 },
          cells: [],
          groups: [],
          maxSerializedBytes: 100, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects snapshot with negative serializedBytes", () => {
      const entry = {
        id: "h12",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: 1 },
          cells: [],
          groups: [],
          maxSerializedBytes: 100, serializedBytes: -1, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });

    it("rejects snapshot with NaN maxSerializedBytes", () => {
      const entry = {
        id: "h13",
        timestamp: "2026-07-01T00:00:00.000Z",
        intent: "Test",
        contextRangeNames: [],
        contextRanges: [],
        targetRangeLabel: "A1",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patchesApplied: 0,
        snapshot: {
          schemaVersion: 1,
          sheet: { id: "s", name: "n", rows: 1, cols: 1 },
          cells: [],
          groups: [],
          maxSerializedBytes: NaN, serializedBytes: 0, truncated: false,
        },
      };
      expect(isMatrixHistoryEntry(entry)).toBe(false);
    });
  });
});
