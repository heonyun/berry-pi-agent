// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createEmptyMatrixDocument,
  formatSelectionSummary,
  getColumnHeader,
  RESEARCH_SHEET_TEMPLATE,
} from "./domain.ts";

describe("getColumnHeader", () => {
  it("returns Excel column labels by default even when semantic template columns exist", () => {
    const doc = createEmptyMatrixDocument();
    expect(getColumnHeader(doc, 0)).toBe("A");
    expect(getColumnHeader(doc, 1)).toBe("B");
    expect(getColumnHeader(doc, 2)).toBe("C");
  });

  it("formats multi-letter Excel column labels", () => {
    const doc = createEmptyMatrixDocument();
    expect(getColumnHeader(doc, 25)).toBe("Z");
    expect(getColumnHeader(doc, 26)).toBe("AA");
  });

  it("uses Excel label when document has no template", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    expect(getColumnHeader(doc, 1)).toBe("B");
  });

  it("appends a custom label without replacing coordinate identity", () => {
    const doc = {
      ...createEmptyMatrixDocument(),
      customColumnLabels: new Map([[1, "Customer"]]),
    };
    expect(getColumnHeader(doc, 1)).toBe("B · Customer");
  });
});

describe("formatSelectionSummary", () => {
  it("returns single-cell label without dimensions", () => {
    expect(
      formatSelectionSummary({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }),
    ).toBe("A1:A1");
  });

  it("appends width×height for multi-cell ranges", () => {
    expect(
      formatSelectionSummary({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    ).toBe("A1:C3 (3×3)");
  });
});

describe("RESEARCH_SHEET_TEMPLATE", () => {
  it("defines semantic columns for research workflow", () => {
    expect(RESEARCH_SHEET_TEMPLATE.columns.map((c) => c.header)).toEqual([
      "ID",
      "Question",
      "Key Answer",
      "Evidence",
      "Status",
      "Notes",
    ]);
  });
});
