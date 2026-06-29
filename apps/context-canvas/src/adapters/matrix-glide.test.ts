// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getMatrixGridConfig, getCellContent } from "./matrix-glide.ts";
import { createEmptyMatrixDocument, cellKey } from "../shared/domain.ts";
import type { Cell } from "../shared/domain.ts";
import type { GridCell } from "@glideapps/glide-data-grid";

function displayDataOf(cell: GridCell): string {
  return "displayData" in cell ? String(cell.displayData) : "";
}

describe("matrix-glide adapter", () => {
  describe("getMatrixGridConfig", () => {
    it("returns 20x50 for default empty document", () => {
      const doc = createEmptyMatrixDocument();
      const config = getMatrixGridConfig(doc);
      expect(config.rows).toBe(20);
      expect(config.cols).toBe(50);
    });
  });

  describe("getCellContent", () => {
    it("returns empty text cell for empty cell", () => {
      const doc = createEmptyMatrixDocument();
      const contentFn = getCellContent(doc);
      const cell = contentFn([0, 0]);
      expect(cell.kind).toBe("text");
      expect("data" in cell ? cell.data : "").toBe("");
      expect("displayData" in cell ? cell.displayData : "").toBe("");
      expect("allowOverlay" in cell ? cell.allowOverlay : false).toBe(true);
    });

    it("shows first line of body as display text (no badges in grid)", () => {
      let doc = createEmptyMatrixDocument();
      // Manually add a cell to the document
      const cell: Cell = {
        value: "completed",
        body: "Task completed successfully.\n\n## Details\n- Step 1 done",
        frontmatter: "",
        provenance: "ai-v2",
      };
      const cells = new Map(doc.sheet.cells);
      cells.set(cellKey(5, 10), cell);
      doc = { ...doc, sheet: { ...doc.sheet, cells } };

      const contentFn = getCellContent(doc);
      const result = contentFn([10, 5]);
      expect(displayDataOf(result)).toBe("Task completed successfully.");
    });

    it("does not show provenance badge in grid display text", () => {
      let doc = createEmptyMatrixDocument();
      const cell: Cell = {
        value: "imported",
        body: "Imported content",
        frontmatter: "source: external",
        provenance: "import",
      };
      const cells = new Map(doc.sheet.cells);
      cells.set(cellKey(0, 0), cell);
      doc = { ...doc, sheet: { ...doc.sheet, cells } };

      const contentFn = getCellContent(doc);
      const result = contentFn([0, 0]);
      expect(displayDataOf(result)).toBe("Imported content");
      expect(displayDataOf(result)).not.toContain("[import]");
    });

    it("does not show frontmatter in display text", () => {
      let doc = createEmptyMatrixDocument();
      const cell: Cell = {
        value: "hidden",
        body: "Visible body",
        frontmatter: "secret: value\nother: data",
      };
      const cells = new Map(doc.sheet.cells);
      cells.set(cellKey(3, 7), cell);
      doc = { ...doc, sheet: { ...doc.sheet, cells } };

      const contentFn = getCellContent(doc);
      const result = contentFn([7, 3]);
      expect(displayDataOf(result)).toBe("Visible body");
      expect(displayDataOf(result)).not.toContain("secret");
      expect(displayDataOf(result)).not.toContain("frontmatter");
    });

    it("falls back to value when body is empty", () => {
      let doc = createEmptyMatrixDocument();
      const cell: Cell = {
        value: 42,
        body: "",
        frontmatter: "",
      };
      const cells = new Map(doc.sheet.cells);
      cells.set(cellKey(2, 5), cell);
      doc = { ...doc, sheet: { ...doc.sheet, cells } };

      const contentFn = getCellContent(doc);
      const result = contentFn([5, 2]);
      expect(displayDataOf(result)).toContain("42");
    });

    it("shows status from body only, not frontmatter chips in grid", () => {
      let doc = createEmptyMatrixDocument();
      const cell: Cell = {
        value: "draft",
        body: "Work in progress",
        frontmatter: "status: draft",
      };
      const cells = new Map(doc.sheet.cells);
      cells.set(cellKey(0, 0), cell);
      doc = { ...doc, sheet: { ...doc.sheet, cells } };

      const contentFn = getCellContent(doc);
      const result = contentFn([0, 0]);
      expect(displayDataOf(result)).toBe("Work in progress");
      expect(displayDataOf(result)).not.toContain("[draft]");
    });
  });
});
