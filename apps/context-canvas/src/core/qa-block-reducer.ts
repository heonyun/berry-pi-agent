import type { QABlockApplyResult, QABlockCommand } from "./qa-block-commands.ts";
import {
  createBlockAt,
  createBlockFromAction,
  createBlockFromComposer,
} from "./qa-block-mutations.ts";
import {
  appendQABlockAnswerVersion,
  findQABlock,
  type QABlockCanvasDocument,
  updateQABlock,
} from "../shared/domain.ts";

export function applyQABlockCommand(
  document: QABlockCanvasDocument,
  command: QABlockCommand,
): QABlockApplyResult {
  switch (command.type) {
    case "create_block_from_composer": {
      const created = createBlockFromComposer(document, {
        question: command.question,
        selectedBlockId: command.selectedBlockId,
        anchor: command.anchor,
      });
      return {
        document: created.document,
        meta: { blockId: created.blockId, parentBlockId: created.parentBlockId },
      };
    }

    case "create_block_at": {
      const created = createBlockAt(document, command.position, command.question ?? "");
      return { document: created.document, meta: { blockId: created.blockId } };
    }

    case "create_block_from_action": {
      const created = createBlockFromAction(document, {
        action: command.action,
        selectedBlockId: command.selectedBlockId,
        anchor: command.anchor,
      });
      return {
        document: created.document,
        meta: { blockId: created.blockId, parentBlockId: created.parentBlockId },
      };
    }

    case "set_block_answer":
      return {
        document: updateQABlock(document, command.blockId, (block) =>
          appendQABlockAnswerVersion(block, { text: command.text }),
        ),
        meta: { blockId: command.blockId },
      };

    case "update_block_question":
      return {
        document: updateQABlock(document, command.blockId, (block) => ({
          ...block,
          question: command.question,
        })),
        meta: { blockId: command.blockId },
      };

    case "move_block":
      return {
        document: updateQABlock(document, command.blockId, (block) => ({
          ...block,
          position: command.position,
          snapPosition: command.syncSnapPosition ? command.position : block.snapPosition,
        })),
        meta: { blockId: command.blockId },
      };

    case "delete_block": {
      const block = findQABlock(document, command.blockId);
      if (!block) {
        return { document, meta: { statusMessage: "Block not found." } };
      }
      return {
        document: {
          ...document,
          blocks: document.blocks.filter((candidate) => candidate.id !== command.blockId),
          edges: document.edges.filter(
            (edge) => edge.source !== command.blockId && edge.target !== command.blockId,
          ),
        },
        meta: { blockId: command.blockId },
      };
    }

    default: {
      const exhaustive: never = command;
      throw new Error(`Unhandled command: ${(exhaustive as QABlockCommand).type}`);
    }
  }
}
