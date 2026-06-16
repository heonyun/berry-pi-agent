// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createInitialDocument } from "../shared/domain.ts";
import { applyCommand } from "./reducer.ts";

describe("applyCommand", () => {
  it("creates a prompt on double-click pane command", () => {
    const initial = createInitialDocument();
    const result = applyCommand(initial, {
      type: "create_prompt_at",
      position: { x: 120, y: 80 },
    });

    expect(result.document.nodes).toHaveLength(2);
    expect(result.meta.promptId).toBeDefined();
    expect(result.meta.statusMessage).toBe("New prompt created");
  });

  it("branches a constructive follow-up prompt", () => {
    let document = createInitialDocument();
    const prepared = applyCommand(document, { type: "ensure_answer_for_prompt", promptId: "prompt-1" });
    document = prepared.document;
    const answerId = prepared.meta.answerId!;

    const branched = applyCommand(document, {
      type: "branch_from_answer",
      answerId,
      direction: "constructive",
    });

    expect(branched.document.nodes).toHaveLength(3);
    expect(branched.meta.promptId).toBeDefined();
    const prompt = branched.document.nodes.find((node) => node.id === branched.meta.promptId);
    expect(prompt?.position.x).toBeGreaterThan(0);
  });

  it("connects context references without duplicates", () => {
    let document = createInitialDocument();
    document = applyCommand(document, {
      type: "create_prompt_at",
      position: { x: 10, y: 10 },
    }).document;

    const first = applyCommand(document, {
      type: "connect_context_reference",
      source: "prompt-1",
      target: document.nodes[1]!.id,
    });
    const second = applyCommand(first.document, {
      type: "connect_context_reference",
      source: "prompt-1",
      target: document.nodes[1]!.id,
    });

    expect(first.document.edges.filter((edge) => edge.meaning === "context_reference")).toHaveLength(1);
    expect(second.document.edges.filter((edge) => edge.meaning === "context_reference")).toHaveLength(1);
  });
});
