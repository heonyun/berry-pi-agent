// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createInitialDocument, normalizeDocument } from "../shared/domain.ts";
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

  it("creates a group from selected nodes with a local summary draft", () => {
    let document = createInitialDocument();
    document = applyCommand(document, {
      type: "create_prompt_at",
      position: { x: 120, y: 40 },
    }).document;

    const result = applyCommand(document, {
      type: "create_group_from_nodes",
      nodeIds: ["prompt-1", document.nodes[1]!.id],
      origin: { x: 50, y: 20 },
    });

    const createdGroup = result.document.groups.find((group) => group.id !== "group-1");
    expect(createdGroup).toMatchObject({
      title: "Group 2",
      origin: { x: 50, y: 20 },
    });
    expect(createdGroup?.summary).toContain("What should we explore on this canvas?");
    expect(result.document.nodes.map((node) => node.groupId)).toEqual([
      createdGroup?.id,
      createdGroup?.id,
    ]);
    expect(result.meta.groupId).toBe(createdGroup?.id);
  });

  it("updates group summaries without changing node membership", () => {
    const initial = createInitialDocument();
    const result = applyCommand(initial, {
      type: "update_group_summary",
      groupId: "group-1",
      summary: "Edited group summary",
    });

    expect(result.document.groups[0]).toMatchObject({
      id: "group-1",
      summary: "Edited group summary",
    });
    expect(result.document.nodes[0]?.groupId).toBe("group-1");
  });

  it("assigns nodes to an existing group", () => {
    let document = createInitialDocument();
    document = applyCommand(document, {
      type: "create_group_from_nodes",
      nodeIds: ["prompt-1"],
      origin: { x: 0, y: 0 },
    }).document;
    const targetGroupId = document.groups.at(-1)!.id;
    document = applyCommand(document, {
      type: "create_prompt_at",
      position: { x: 120, y: 40 },
    }).document;
    const newPromptId = document.nodes.at(-1)!.id;

    const result = applyCommand(document, {
      type: "assign_nodes_to_group",
      groupId: targetGroupId,
      nodeIds: [newPromptId],
    });

    expect(result.document.nodes.find((node) => node.id === newPromptId)?.groupId).toBe(targetGroupId);
    expect(result.meta.groupId).toBe(targetGroupId);
  });

  it("rejects assignment to an unknown group", () => {
    expect(() =>
      applyCommand(createInitialDocument(), {
        type: "assign_nodes_to_group",
        groupId: "missing-group",
        nodeIds: ["prompt-1"],
      }),
    ).toThrow("Unknown group");
  });
});

describe("normalizeDocument", () => {
  it("defaults missing group summaries to an empty string", () => {
    const legacy = {
      ...createInitialDocument(),
      groups: createInitialDocument().groups.map(({ summary: _summary, ...group }) => group),
    };

    expect(normalizeDocument(legacy).groups[0]?.summary).toBe("");
  });
});
