// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createEmptyMatrixDocument,
  getColumnHeader,
  RESEARCH_SHEET_TEMPLATE,
} from "./domain.ts";

describe("getColumnHeader", () => {
  it("returns template header when column has a role", () => {
    const doc = createEmptyMatrixDocument();
    expect(getColumnHeader(doc, 1)).toBe("Question");
    expect(getColumnHeader(doc, 2)).toBe("Key Answer");
  });

  it("falls back to Excel column label for unmapped columns", () => {
    const doc = createEmptyMatrixDocument();
    expect(getColumnHeader(doc, 10)).toBe("K");
  });

  it("uses Excel label when document has no template", () => {
    const doc = createEmptyMatrixDocument({ withResearchTemplate: false });
    expect(getColumnHeader(doc, 1)).toBe("B");
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
