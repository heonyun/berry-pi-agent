import { describe, expect, it } from "vitest";
import { compilePromptContext, formatPromptForPi } from "./compiler.ts";
import { createInitialDocument, type ContextCanvasDocument } from "./domain.ts";

describe("formatPromptForPi", () => {
  it("does not duplicate compiled context text", () => {
    const document: ContextCanvasDocument = {
      ...createInitialDocument(),
      nodes: [
        {
          id: "answer-1",
          kind: "ai_answer",
          groupId: "group-1",
          text: "Prior answer",
          position: { x: 0, y: -240 },
          metadata: { stance: "neutral" },
          feedback: "needs_retry",
        },
        {
          id: "prompt-2",
          kind: "prompt_input",
          groupId: "group-1",
          text: "Follow up",
          position: { x: 0, y: -480 },
          metadata: { stance: "neutral" },
        },
      ],
      edges: [
        {
          id: "edge-ref-answer-1-prompt-2",
          source: "answer-1",
          target: "prompt-2",
          meaning: "context_reference",
        },
      ],
    };

    const compiled = compilePromptContext(document, "prompt-2");
    const prompt = formatPromptForPi(compiled);

    expect(prompt.match(/reference: answer-1/g)).toHaveLength(1);
    expect(prompt.match(/text: Prior answer/g)).toHaveLength(1);
  });
});
