// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compileMatrixRangeContextStub } from "./compile-matrix-range-context.ts";
import { applyMatrixCommand } from "../core/matrix-reducer.ts";
import { cellKey, createEmptyMatrixDocument } from "./domain.ts";

describe("compileMatrixRangeContextStub", () => {
  it("includes plain-text cell excerpts for the selected range", () => {
    let document = createEmptyMatrixDocument();
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [{ row: 0, col: 0, value: "seed", body: "Hello matrix" }],
    }).document;

    const compiled = compileMatrixRangeContextStub(
      document,
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      "Summarize",
    );

    expect(compiled.contextText).toContain("A1: Hello matrix");
    expect(compiled.targetRangeLabel).toBe("A1:A1");
    expect(compiled.messages[0]?.role).toBe("system");
    expect(compiled.messages[1]?.content).toContain("Summarize");
  });

  it("reports empty range when no cells are populated", () => {
    const document = createEmptyMatrixDocument();
    const compiled = compileMatrixRangeContextStub(
      document,
      { startRow: 1, startCol: 1, endRow: 2, endCol: 2 },
      "Fill cells",
    );

    expect(compiled.contextText).toBe("(empty range)");
    expect(document.sheet.cells.has(cellKey(1, 1))).toBe(false);
  });
});
