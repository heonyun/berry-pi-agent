// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyQABlockCommand } from "./qa-block-reducer.ts";
import { createEmptyQABlockDocument } from "../shared/domain.ts";

describe("applyQABlockCommand", () => {
  it("creates the first block at anchor when composer submits with no selection", () => {
    const result = applyQABlockCommand(createEmptyQABlockDocument(), {
      type: "create_block_from_composer",
      question: "Hello?",
      selectedBlockId: null,
      anchor: { x: 40, y: 120 },
    });

    expect(result.meta.blockId).toBeTruthy();
    const block = result.document.blocks[0];
    expect(block?.question).toBe("Hello?");
    expect(block?.position).toEqual({ x: 40, y: 120 });
    expect(result.document.edges).toHaveLength(0);
  });

  it("creates a parallel block when selection has a block above in the same column", () => {
    let doc = createEmptyQABlockDocument();
    const first = applyQABlockCommand(doc, {
      type: "create_block_from_composer",
      question: "First",
      selectedBlockId: null,
      anchor: { x: 0, y: 0 },
    });
    doc = first.document;
    const second = applyQABlockCommand(doc, {
      type: "create_block_from_composer",
      question: "Second",
      selectedBlockId: null,
    });
    doc = second.document;
    const branch = applyQABlockCommand(doc, {
      type: "create_block_from_composer",
      question: "Branch",
      selectedBlockId: first.meta.blockId!,
    });

    const block = branch.document.blocks.find((candidate) => candidate.id === branch.meta.blockId);
    expect(block?.position).toEqual({ x: 540, y: -360 });
    expect(branch.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: first.meta.blockId,
          target: branch.meta.blockId,
          meaning: "lineage",
        }),
      ]),
    );
  });

  it("creates action preset blocks from selected context", () => {
    let doc = createEmptyQABlockDocument();
    const first = applyQABlockCommand(doc, {
      type: "create_block_from_composer",
      question: "Seed",
      selectedBlockId: null,
      anchor: { x: 0, y: 0 },
    });
    doc = first.document;
    const action = applyQABlockCommand(doc, {
      type: "create_block_from_action",
      action: "risks",
      selectedBlockId: first.meta.blockId!,
    });

    const block = action.document.blocks.find((candidate) => candidate.id === action.meta.blockId);
    expect(block?.question).toContain("위험");
  });
});
