// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createInitialDocument, type ContextCanvasDocument } from "../shared/domain.ts";
import { toReactFlowNodes } from "./react-flow.ts";

function callbacks() {
  return {
    onDraftChange: vi.fn(),
    onTextChange: vi.fn(),
    onRun: vi.fn(),
    onArmDelete: vi.fn(),
    onDelete: vi.fn(),
    onFeedback: vi.fn(),
    onRetry: vi.fn(),
    onAnswerAction: vi.fn(),
  };
}

describe("toReactFlowNodes", () => {
  it("marks answer nodes as selected or multi-selected for action gating", () => {
    const document: ContextCanvasDocument = {
      ...createInitialDocument(),
      nodes: [
        {
          id: "answer-1",
          kind: "ai_answer",
          groupId: "group-1",
          text: "Answer",
          position: { x: 0, y: -240 },
          metadata: { stance: "neutral" },
        },
        {
          id: "prompt-2",
          kind: "prompt_input",
          groupId: "group-1",
          text: "Prompt",
          position: { x: 0, y: -480 },
          metadata: { stance: "neutral" },
        },
      ],
    };

    const nodes = toReactFlowNodes({
      document,
      runningPromptId: null,
      callbacks: callbacks(),
      selectedNodeIds: new Set(["answer-1", "prompt-2"]),
    });

    const answer = nodes.find((node) => node.id === "answer-1");
    expect(answer?.data.selected).toBe(true);
    expect(answer?.data.multiSelected).toBe(true);
  });
});
