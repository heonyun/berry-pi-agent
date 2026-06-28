// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  compileMatrixRangeContext,
  compileMatrixRangeContextStub,
} from "./compile-matrix-range-context.ts";
import { applyMatrixCommand } from "../core/matrix-reducer.ts";
import { cellKey, createEmptyMatrixDocument } from "./domain.ts";

describe("compileMatrixRangeContext", () => {
  it("compiles separate context and target ranges with structured blocks", () => {
    let document = createEmptyMatrixDocument();
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: "in1", body: "Input one" },
        { row: 1, col: 0, value: "in2", body: "Input two" },
        { row: 0, col: 4, value: "out", body: "Output seed" },
      ],
    }).document;

    const compiled = compileMatrixRangeContext(
      document,
      [{ label: "inputs", range: { startRow: 0, startCol: 0, endRow: 1, endCol: 0 } }],
      { startRow: 0, startCol: 4, endRow: 4, endCol: 4 },
      "Summarize inputs into outputs",
    );

    expect(compiled.contextText).toContain("## inputs (A1:A2)");
    expect(compiled.contextText).toContain("A1: Input one");
    expect(compiled.contextText).toContain("A2: Input two");
    expect(compiled.contextText).not.toContain("E1: Output seed");
    expect(compiled.targetRangeLabel).toBe("E1:E5");
    expect(compiled.contextRangeLabels).toEqual(["inputs (A1:A2)"]);
    expect(compiled.messages[1]?.content).toContain("Summarize inputs into outputs");
  });

  it("supports multiple context range blocks", () => {
    let document = createEmptyMatrixDocument();
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: "a", body: "Alpha" },
        { row: 0, col: 1, value: "b", body: "Beta" },
      ],
    }).document;

    const compiled = compileMatrixRangeContext(
      document,
      [
        { label: "left", range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 } },
        { label: "right", range: { startRow: 0, startCol: 1, endRow: 0, endCol: 1 } },
      ],
      { startRow: 2, startCol: 2, endRow: 2, endCol: 2 },
      "Merge",
    );

    expect(compiled.contextRangeLabels).toHaveLength(2);
    expect(compiled.contextText).toContain("## left (A1:A1)");
    expect(compiled.contextText).toContain("## right (B1:B1)");
  });

  it("reports empty context when no cells are populated in context ranges", () => {
    const document = createEmptyMatrixDocument();
    const compiled = compileMatrixRangeContext(
      document,
      [{ label: "empty", range: { startRow: 1, startCol: 1, endRow: 2, endCol: 2 } }],
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      "Fill cells",
    );

    expect(compiled.contextText).toContain("(empty range)");
  });
});

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

    expect(compiled.contextText).toContain("(empty range)");
    expect(document.sheet.cells.has(cellKey(1, 1))).toBe(false);
  });
});
