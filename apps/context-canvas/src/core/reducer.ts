import {
  appendAnswerVersion,
  findNode,
  type ContextCanvasDocument,
  type ContextEdge,
  updateNode,
} from "../shared/domain.ts";
import type { ApplyResult, CanvasCommand } from "./commands.ts";
import {
  branchFromAnswer,
  createPromptAt,
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

    case "set_feedback":
      return {
        document: updateNode(document, command.nodeId, (node) =>
          node.kind === "ai_answer" ? { ...node, feedback: command.feedback } : node,
        ),
        meta: {},
      };

    case "branch_from_answer": {
      const created = branchFromAnswer(document, command.answerId, command.direction);
      return {
        document: created.document,
        meta: {
          promptId: created.promptId,
          statusMessage:
            command.direction === "critical"
              ? "Critical follow-up prompt created"
              : "Constructive follow-up prompt created",
        },
      };
    }

    case "create_prompt_at": {
      const created = createPromptAt(document, command.position, command.parentAnswerId);
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
