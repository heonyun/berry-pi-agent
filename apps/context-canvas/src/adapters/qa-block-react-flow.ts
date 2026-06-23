import type { Edge, Node } from "@xyflow/react";
import { blockDetached } from "../core/magnetic-layout.ts";
import type { AnswerAction } from "./react-flow.ts";
import type { QABlockAnswerAction } from "../core/qa-block-commands.ts";
import {
  QA_BLOCK_MAGNETIC_DETACH_THRESHOLD,
  type QABlockCanvasDocument,
  type StanceBand,
} from "../shared/domain.ts";
import type { QABlockNodeData } from "../web/QABlockNode.tsx";

export type QABlockFlowNode = Node<QABlockNodeData>;

export interface QABlockReactFlowInput {
  document: QABlockCanvasDocument;
  runningBlockId: string | null;
  selectedBlockId: string | null;
  expandedBlockId: string | null;
  callbacks: {
    onQuestionChange: (blockId: string, question: string) => void;
    onSelect: (blockId: string) => void;
    onToggleExpand: (blockId: string) => void;
    onAnswerAction: (blockId: string, action: AnswerAction) => void;
    onArmDelete: (blockId: string) => void;
    onDelete: (blockId: string) => void;
  };
  deleteArmedBlockId?: string | null;
}

function stanceForBlock(document: QABlockCanvasDocument, blockId: string): StanceBand {
  const block = document.blocks.find((candidate) => candidate.id === blockId);
  return block?.metadata.stance ?? "neutral";
}

export function toQABlockFlowNodes(input: QABlockReactFlowInput): QABlockFlowNode[] {
  const {
    document,
    runningBlockId,
    selectedBlockId,
    expandedBlockId,
    callbacks,
    deleteArmedBlockId,
  } = input;

  return document.blocks.map((block) => ({
    id: block.id,
    type: "qaBlock",
    position: block.position,
    dragHandle: ".node-drag-handle",
    selected: block.id === selectedBlockId,
    data: {
      blockId: block.id,
      question: block.question,
      answer: block.answer,
      stance: stanceForBlock(document, block.id),
      expanded: block.id === expandedBlockId,
      running: runningBlockId === block.id,
      selected: block.id === selectedBlockId,
      deleteArmed: deleteArmedBlockId === block.id,
      onQuestionChange: callbacks.onQuestionChange,
      onSelect: callbacks.onSelect,
      onToggleExpand: callbacks.onToggleExpand,
      onAnswerAction: callbacks.onAnswerAction,
      onArmDelete: callbacks.onArmDelete,
      onDelete: callbacks.onDelete,
    },
  }));
}

export function toQABlockFlowEdges(document: QABlockCanvasDocument): Edge[] {
  return document.edges
    .filter((edge) => edge.meaning === "lineage")
    .map((edge) => {
      const target = document.blocks.find((block) => block.id === edge.target);
      const detached =
        target !== undefined && blockDetached(target.position, target.snapPosition);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        hidden: !detached,
        className: detached ? "qa-block-edge-detached" : "qa-block-edge-attached",
        style: detached ? undefined : { opacity: 0 },
      };
    });
}

export function mapAnswerActionToQABlock(action: AnswerAction): QABlockAnswerAction {
  return action;
}

export { QA_BLOCK_MAGNETIC_DETACH_THRESHOLD };
