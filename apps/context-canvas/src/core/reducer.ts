import {
  appendAnswerVersion,
  findNode,
  type ContextCanvasDocument,
  type ContextEdge,
  type ContextNode,
  updateNode,
} from "../shared/domain.ts";
import type { ApplyResult, CanvasCommand } from "./commands.ts";
import {
  createPromptAt,
  createPromptFromSource,
  ensureAnswerForPrompt,
  ensureNextPrompt,
} from "./mutations.ts";
import { setAnswerTextOnDocument } from "./stance.ts";

export function applyCommand(document: ContextCanvasDocument, command: CanvasCommand): ApplyResult {
  switch (command.type) {
    case "update_prompt_text":
      return {
        document: updateNode(document, command.nodeId, (node) =>
          node.kind === "prompt_input" ? { ...node, text: command.text } : node,
        ),
        meta: {},
      };

    case "set_answer_text":
      return {
        document: setAnswerTextOnDocument(document, command.answerId, command.text),
        meta: {},
      };

    case "move_node":
      return {
        document: updateNode(document, command.nodeId, (node) => ({
          ...node,
          position: command.position,
        })),
        meta: {},
      };

    case "delete_node":
      return {
        document: {
          ...document,
          nodes: document.nodes.filter((node) => node.id !== command.nodeId),
          edges: document.edges.filter(
            (edge) => edge.source !== command.nodeId && edge.target !== command.nodeId,
          ),
        },
        meta: {},
      };

    case "set_feedback":
      return {
        document: updateNode(document, command.nodeId, (node) =>
          node.kind === "ai_answer" ? { ...node, feedback: command.feedback } : node,
        ),
        meta: {},
      };

    case "create_group_from_nodes": {
      const nodeIds = [...new Set(command.nodeIds)];
      if (nodeIds.length === 0) {
        return { document, meta: { statusMessage: "No nodes selected for group." } };
      }
      const groupId = nextGroupId(document);
      const selectedNodes = orderNodesForSummary(
        document.nodes.filter((node) => nodeIds.includes(node.id)),
      );
      const now = new Date().toISOString();
      const group = {
        id: groupId,
        title: command.title ?? `Group ${document.groups.length + 1}`,
        origin: command.origin,
        summary: command.summary ?? buildGroupSummaryDraft(selectedNodes),
        updatedAt: now,
      };
      return {
        document: {
          ...document,
          groups: [...document.groups, group],
          nodes: document.nodes.map((node) =>
            nodeIds.includes(node.id) ? { ...node, groupId } : node,
          ),
        },
        meta: { groupId, statusMessage: "Group created" },
      };
    }

    case "assign_nodes_to_group": {
      const groupExists = document.groups.some((group) => group.id === command.groupId);
      if (!groupExists) {
        throw new Error(`Unknown group: ${command.groupId}`);
      }
      const nodeIds = new Set(command.nodeIds);
      return {
        document: {
          ...document,
          nodes: document.nodes.map((node) =>
            nodeIds.has(node.id) ? { ...node, groupId: command.groupId } : node,
          ),
        },
        meta: { groupId: command.groupId, statusMessage: "Nodes assigned to group" },
      };
    }

    case "update_group_summary":
      return {
        document: {
          ...document,
          groups: document.groups.map((group) =>
            group.id === command.groupId
              ? { ...group, summary: command.summary, updatedAt: new Date().toISOString() }
              : group,
          ),
        },
        meta: { groupId: command.groupId },
      };

    case "create_prompt_at": {
      const created = createPromptAt(document, command.position, command.parentAnswerId);
      return {
        document: created.document,
        meta: { promptId: created.promptId, statusMessage: "New prompt created" },
      };
    }

    case "create_prompt_from_source": {
      const created = createPromptFromSource(
        document,
        command.sourceNodeId,
        command.position,
        command.sourceHandle,
      );
      return {
        document: created.document,
        meta: { promptId: created.promptId, statusMessage: "New prompt created" },
      };
    }

    case "connect_context_reference": {
      const duplicate = document.edges.some(
        (edge) =>
          edge.source === command.source &&
          edge.target === command.target &&
          edge.meaning === "context_reference",
      );
      if (duplicate) {
        return { document, meta: {} };
      }
      const edge: ContextEdge = {
        id: `edge-ref-${command.source}-${command.target}`,
        source: command.source,
        target: command.target,
        meaning: "context_reference",
        sourceHandle: command.sourceHandle,
        targetHandle: command.targetHandle,
      };
      return {
        document: { ...document, edges: [...document.edges, edge] },
        meta: {},
      };
    }

    case "ensure_answer_for_prompt": {
      const prepared = ensureAnswerForPrompt(document, command.promptId);
      return {
        document: prepared.document,
        meta: {
          answerId: prepared.answerId,
          createdAnswer: prepared.created,
        },
      };
    }

    case "ensure_next_prompt": {
      const next = ensureNextPrompt(document, command.answerId);
      const nextPrompt = next.edges.find(
        (edge) => edge.source === command.answerId && edge.meaning === "lineage",
      );
      return {
        document: next,
        meta: {
          promptId: nextPrompt?.target,
          statusMessage: "Run complete",
        },
      };
    }

    case "prepare_answer_retry": {
      const answer = findNode(document, command.answerId);
      if (answer.kind !== "ai_answer") {
        throw new Error("Retry target is not an answer node.");
      }
      const updatedAnswer = appendAnswerVersion(answer, {
        text: "",
        feedback: "needs_retry",
      });
      return {
        document: updateNode(document, command.answerId, () => updatedAnswer),
        meta: { answerId: command.answerId },
      };
    }

    default: {
      const exhaustive: never = command;
      throw new Error(`Unhandled command: ${(exhaustive as CanvasCommand).type}`);
    }
  }
}

function nextGroupId(document: ContextCanvasDocument): string {
  let index = document.groups.length + 1;
  const existing = new Set(document.groups.map((group) => group.id));
  while (existing.has(`group-${index}`)) {
    index += 1;
  }
  return `group-${index}`;
}

function orderNodesForSummary(nodes: ContextNode[]): ContextNode[] {
  return [...nodes].sort((left, right) => {
    const y = left.position.y - right.position.y;
    if (y !== 0) {
      return y;
    }
    const x = left.position.x - right.position.x;
    if (x !== 0) {
      return x;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildGroupSummaryDraft(nodes: ContextNode[]): string {
  return nodes
    .map((node) => {
      const label = node.kind === "prompt_input" ? "Prompt" : "AI Answer";
      const text = node.text.trim() || "(empty)";
      return `${label} ${node.id}: ${text}`;
    })
    .join("\n\n");
}
