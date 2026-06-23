// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyQABlockCommand } from "../core/qa-block-reducer.ts";
import { compileQABlockContext } from "./compile-qablock-context.ts";
import { createEmptyQABlockDocument } from "./domain.ts";

describe("compileQABlockContext", () => {
  it("includes lineage ancestor Q&A in compiled context", () => {
    let doc = createEmptyQABlockDocument();
    const first = applyQABlockCommand(doc, {
      type: "create_block_from_composer",
      question: "Root question",
      selectedBlockId: null,
      anchor: { x: 0, y: 0 },
    });
    doc = first.document;
    doc = applyQABlockCommand(doc, {
      type: "set_block_answer",
      blockId: first.meta.blockId!,
      text: "Root answer",
    }).document;
    const child = applyQABlockCommand(doc, {
      type: "create_block_from_composer",
      question: "Follow-up",
      selectedBlockId: first.meta.blockId!,
    });

    const compiled = compileQABlockContext(child.document, child.meta.blockId!);
    expect(compiled.referencedNodeIds).toEqual([first.meta.blockId]);
    expect(compiled.contextText).toContain("Root question");
    expect(compiled.contextText).toContain("Root answer");
    expect(compiled.messages.at(-1)?.content).toContain("Follow-up");
  });
});
