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

  it("includes editable group summaries and group member context for prompts in a group", () => {
    const document: ContextCanvasDocument = {
      ...createInitialDocument(),
      groups: [
        {
          id: "group-1",
          title: "Conversation",
          origin: { x: 0, y: 0 },
          summary: "User-edited summary of the group.",
        },
      ],
      nodes: [
        {
          id: "answer-1",
          kind: "ai_answer",
          groupId: "group-1",
          text: "Prior group answer",
          position: { x: 0, y: -240 },
          metadata: { stance: "neutral" },
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
      edges: [],
    };

    const compiled = compilePromptContext(document, "prompt-2");

    expect(compiled.contextText).toContain("group_summary: User-edited summary of the group.");
    expect(compiled.contextText).toContain("group_member: answer-1");
    expect(compiled.contextText).toContain("text: Prior group answer");
    expect(compiled.trace).toContainEqual({
      nodeId: "group-1",
      reason: "group_summary",
    });
  });
});
