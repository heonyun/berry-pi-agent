// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyMatrixCommand } from "./matrix-reducer.ts";
import { createEmptyMatrixDocument, formatRangeLabel, cellKey } from "../shared/domain.ts";

describe("applyMatrixCommand", () => {
  describe("acceptance criterion 1: selected range becomes AI command context", () => {
    it("formats range labels correctly (B2:D8)", () => {
      // B=1,2→1+1=2 / D=3,8→7+1=8
      const label = formatRangeLabel(1, 1, 3, 7);
      expect(label).toBe("B2:D8");
    });

    it("formats range A1:Z100 correctly", () => {
      const label = formatRangeLabel(0, 0, 25, 99);
      expect(label).toBe("A1:Z100");
    });

    it("formats single cell range correctly", () => {
      const label = formatRangeLabel(0, 0, 0, 0);
      expect(label).toBe("A1:A1");
    });
  });

  describe("acceptance criterion 2: mock AI write patches update target cells safely", () => {
    it("applies validated write patches to the matrix document", () => {
      let doc = createEmptyMatrixDocument();

      const result = applyMatrixCommand(doc, {
        type: "mock_ai_command",
        targetRange: { startRow: 1, startCol: 4, endRow: 7, endCol: 4 },
        patches: [
          { row: 1, col: 4, value: "context-loaded", body: "Context data loaded", provenance: "ai-v1" },
          { row: 2, col: 4, value: "analyzed", body: "Analysis complete", provenance: "ai-v1" },
          { row: 3, col: 4, value: "ready", body: "Ready for review" },
        ],
      });

      expect(result.meta.updatedCells).toBe(3);
      // targetRange should be present in meta
      expect(result.meta).toHaveProperty("targetRange");
      if ("targetRange" in result.meta) {
        expect(result.meta.targetRange).toEqual({ startRow: 1, startCol: 4, endRow: 7, endCol: 4 });
      }

      // Read back from domain state
      const cell1 = result.document.sheet.cells.get(cellKey(1, 4));
      expect(cell1?.value).toBe("context-loaded");
      expect(cell1?.body).toBe("Context data loaded");
      expect(cell1?.provenance).toBe("ai-v1");

      const cell2 = result.document.sheet.cells.get(cellKey(2, 4));
      expect(cell2?.value).toBe("analyzed");

      const cell3 = result.document.sheet.cells.get(cellKey(3, 4));
      expect(cell3?.value).toBe("ready");
      // Cell without explicit provenance preserves undefined
      expect(cell3?.provenance).toBeUndefined();
    });

    it("clamps patches outside sheet bounds", () => {
      let doc = createEmptyMatrixDocument();

      const result = applyMatrixCommand(doc, {
        type: "mock_ai_command",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patches: [
          { row: -1, col: 0, value: "negative", body: "negative row" },
          { row: 999, col: 999, value: "out", body: "out of bounds" },
          { row: 0, col: 0, value: "valid", body: "in bounds" },
        ],
      });

      // Only one valid patch applied
      expect(result.meta.updatedCells).toBe(1);
      expect(result.document.sheet.cells.get(cellKey(0, 0))?.value).toBe("valid");
      expect(result.document.sheet.cells.has(cellKey(-1, 0))).toBe(false);
      expect(result.document.sheet.cells.has(cellKey(999, 999))).toBe(false);
    });

    it("applies patches through apply_patches command type", () => {
      let doc = createEmptyMatrixDocument();

      const result = applyMatrixCommand(doc, {
        type: "apply_patches",
        patches: [
          { row: 0, col: 0, value: "hello", body: "Hello world" },
        ],
      });

      expect(result.meta.updatedCells).toBe(1);
      expect(result.document.sheet.cells.get(cellKey(0, 0))?.value).toBe("hello");
    });

    it("reads from nextCells when applying multiple patches to the same cell in one batch", () => {
      let doc = createEmptyMatrixDocument();

      // Two patches targeting the same cell — second should see first'"'"'s frontmatter
      const result = applyMatrixCommand(doc, {
        type: "apply_patches",
        patches: [
          { row: 0, col: 0, value: "first", body: "First write", frontmatter: "tags: [a]" },
          { row: 0, col: 0, value: "second", body: "Second write" },
        ],
      });

      expect(result.meta.updatedCells).toBe(2);
      const cell = result.document.sheet.cells.get(cellKey(0, 0));
      // Second patch has no explicit frontmatter, so it should inherit from first via nextCells
      expect(cell?.value).toBe("second");
      expect(cell?.body).toBe("Second write");
      expect(cell?.frontmatter).toBe("tags: [a]");
    });
  });

  describe("acceptance criterion 3: markdown cell editing stays outside grid state", () => {
    it("updates cell body through command/reducer path", () => {
      let doc = createEmptyMatrixDocument();

      // First seed cell via patch
      doc = applyMatrixCommand(doc, {
        type: "apply_patches",
        patches: [
          { row: 0, col: 0, value: "seed", body: "Initial body", frontmatter: "tags: [test]" },
        ],
      }).document;

      // Update body via command (side panel edit path)
      const result = applyMatrixCommand(doc, {
        type: "update_cell_body",
        row: 0,
        col: 0,
        body: "## Updated Markdown\n\nNew content here",
      });

      const cell = result.document.sheet.cells.get(cellKey(0, 0));
      expect(cell?.body).toBe("## Updated Markdown\n\nNew content here");
      // Value and frontmatter preserved from domain state
      expect(cell?.value).toBe("seed");
      expect(cell?.frontmatter).toBe("tags: [test]");
    });

    it("preserves existing cell data when updating body only", () => {
      let doc = createEmptyMatrixDocument();

      doc = applyMatrixCommand(doc, {
        type: "apply_patches",
        patches: [
          { row: 2, col: 3, value: 42, body: "Original", provenance: "import" },
        ],
      }).document;

      const result = applyMatrixCommand(doc, {
        type: "update_cell_body",
        row: 2,
        col: 3,
        body: "Updated via side panel command",
      });

      const cell = result.document.sheet.cells.get(cellKey(2, 3));
      expect(cell?.body).toBe("Updated via side panel command");
      expect(cell?.value).toBe(42);
      expect(cell?.provenance).toBe("import");
    });

    it("clear_cell removes the cell from domain state", () => {
      let doc = createEmptyMatrixDocument();

      doc = applyMatrixCommand(doc, {
        type: "apply_patches",
        patches: [
          { row: 1, col: 1, value: "temp", body: "Temporary" },
        ],
      }).document;

      expect(doc.sheet.cells.has(cellKey(1, 1))).toBe(true);

      const result = applyMatrixCommand(doc, {
        type: "clear_cell",
        row: 1,
        col: 1,
      });

      expect(result.document.sheet.cells.has(cellKey(1, 1))).toBe(false);
      expect(result.meta.updatedCells).toBe(1);
    });

    it("ignores out-of-bounds direct cell commands", () => {
      const doc = createEmptyMatrixDocument();

      const updateResult = applyMatrixCommand(doc, {
        type: "update_cell_body",
        row: -1,
        col: 0,
        body: "Should not be written",
      });

      expect(updateResult.meta.updatedCells).toBe(0);
      expect(updateResult.document.sheet.cells.size).toBe(0);

      const clearResult = applyMatrixCommand(doc, {
        type: "clear_cell",
        row: 20,
        col: 0,
      });

      expect(clearResult.meta.updatedCells).toBe(0);
      expect(clearResult.document.sheet.cells.size).toBe(0);
    });
  });

  describe("Phase 1: named ranges and apply_ai_command", () => {
    it("set_named_range upserts a named range on the document", () => {
      const doc = createEmptyMatrixDocument();
      const range = { startRow: 0, startCol: 0, endRow: 4, endCol: 4 };

      const result = applyMatrixCommand(doc, {
        type: "set_named_range",
        namedRange: { name: "outputs", range },
      });

      expect(result.document.namedRanges.get("outputs")).toEqual({ name: "outputs", range });
      expect(result.meta.message).toContain("outputs");
    });

    it("remove_named_range deletes a named range", () => {
      let doc = createEmptyMatrixDocument();
      doc = applyMatrixCommand(doc, {
        type: "set_named_range",
        namedRange: {
          name: "inputs",
          range: { startRow: 0, startCol: 0, endRow: 2, endCol: 0 },
        },
      }).document;

      const result = applyMatrixCommand(doc, { type: "remove_named_range", name: "inputs" });

      expect(result.document.namedRanges.has("inputs")).toBe(false);
    });

    it("apply_ai_command applies validated patches with intent meta", () => {
      const doc = createEmptyMatrixDocument();
      const targetRange = { startRow: 1, startCol: 4, endRow: 2, endCol: 4 };

      const result = applyMatrixCommand(doc, {
        type: "apply_ai_command",
        command: {
          intent: "Fill status cells",
          targetRange,
          patches: [
            { row: 1, col: 4, value: "done", body: "Done", provenance: "matrix-run" },
            { row: 2, col: 4, value: "done", body: "Done", provenance: "matrix-run" },
          ],
        },
      });

      expect(result.meta.updatedCells).toBe(2);
      expect(result.meta.targetRange).toEqual(targetRange);
      expect(result.meta.message).toBe("Fill status cells");
      expect(result.document.sheet.cells.get(cellKey(1, 4))?.provenance).toBe("matrix-run");
    });

    it("apply_ai_command strips patches outside targetRange with warning meta", () => {
      const doc = createEmptyMatrixDocument();
      const targetRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };

      const result = applyMatrixCommand(doc, {
        type: "apply_ai_command",
        command: {
          intent: "Fill A1 only",
          targetRange,
          patches: [
            { row: 0, col: 0, value: "ok", body: "In range" },
            { row: 1, col: 1, value: "skip", body: "Out of range" },
          ],
        },
      });

      expect(result.meta.updatedCells).toBe(1);
      expect(result.meta.strippedPatches).toBe(1);
      expect(result.meta.message).toContain("outside target range skipped");
      expect(result.document.sheet.cells.has(cellKey(1, 1))).toBe(false);
      expect(result.document.sheet.cells.get(cellKey(0, 0))?.body).toBe("In range");
    });
  });

  describe("cell summary and metadata badge contract", () => {
    it("cell has body + frontmatter + provenance but grid only shows summary and badge", () => {
      const doc = createEmptyMatrixDocument();

      const result = applyMatrixCommand(doc, {
        type: "apply_patches",
        patches: [
          {
            row: 5,
            col: 10,
            value: "completed",
            body: "Task completed successfully.\n\n## Details\n- Step 1 done\n- Step 2 done",
            provenance: "ai-v2",
          },
        ],
      });

      const cell = result.document.sheet.cells.get(cellKey(5, 10));
      // Domain state holds full Markdown body
      expect(cell?.body).toContain("Task completed successfully");
      expect(cell?.body).toContain("## Details");
      // Provenance badge data preserved
      expect(cell?.provenance).toBe("ai-v2");
      // Frontmatter is empty (hidden metadata)
      expect(cell?.frontmatter).toBe("");
    });
  });
});
