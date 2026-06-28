// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseAiCommand, validateWritePatches, WritePatchSchema, AiCommandSchema, filterPatchesToTargetRange } from "./matrix-validation.ts";

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
});
