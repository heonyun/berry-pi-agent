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

  it("creates a prompt from any source node with a lineage edge", () => {
    const initial = createInitialDocument();
    const created = applyCommand(initial, {
      type: "create_prompt_from_source",
      sourceNodeId: "prompt-1",
      position: { x: 240, y: 120 },
      sourceHandle: "branch-right",
    });

    expect(created.document.nodes).toHaveLength(2);
    expect(created.meta.promptId).toBeDefined();
    expect(created.document.edges).toEqual([
      expect.objectContaining({
        source: "prompt-1",
        target: created.meta.promptId,
        meaning: "lineage",
        sourceHandle: "branch-right",
      }),
    ]);
  });

  it("deletes a node and its attached edges", () => {
    let document = createInitialDocument();
    const created = applyCommand(document, {
      type: "create_prompt_from_source",
      sourceNodeId: "prompt-1",
      position: { x: 240, y: 120 },
    });
    document = created.document;

    const deleted = applyCommand(document, {
      type: "delete_node",
      nodeId: created.meta.promptId!,
    });

    expect(deleted.document.nodes.map((node) => node.id)).toEqual(["prompt-1"]);
    expect(deleted.document.edges).toHaveLength(0);
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
      sourceHandle: "branch-right",
      targetHandle: "target-bottom",
    });
    const second = applyCommand(first.document, {
      type: "connect_context_reference",
      source: "prompt-1",
      target: document.nodes[1]!.id,
    });

    expect(first.document.edges.filter((edge) => edge.meaning === "context_reference")).toHaveLength(1);
    expect(first.document.edges[0]).toMatchObject({
      sourceHandle: "branch-right",
      targetHandle: "target-bottom",
    });
    expect(second.document.edges.filter((edge) => edge.meaning === "context_reference")).toHaveLength(1);
  });
});
