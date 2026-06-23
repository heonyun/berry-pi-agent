import type { QABlockAnswerAction } from "./qa-block-commands.ts";
import { resolveNewBlockPlacement } from "./magnetic-layout.ts";
import { nextId, roundedPosition } from "./mutations.ts";
import {
  type ContextEdge,
  type QABlock,
  type QABlockCanvasDocument,
  type Vec2,
} from "../shared/domain.ts";

const ACTION_QUESTIONS: Record<QABlockAnswerAction, string> = {
  risks: "좋아. 너의 답에서 예상 문제와 위험을 말해.",
  positives: "좋아. 너의 답에서 예상 긍정을 말해.",
  risk_retry: "다시 너의 답에 문제와 위험을 생각해서 답해.",
};

export function actionQuestion(action: QABlockAnswerAction): string {
  return ACTION_QUESTIONS[action];
}

function lineageParentId(
  document: QABlockCanvasDocument,
  blockId: string,
): string | null {
  const edge = document.edges.find(
    (candidate) => candidate.target === blockId && candidate.meaning === "lineage",
  );
  return edge?.source ?? null;
}

function contextParentId(
  document: QABlockCanvasDocument,
  selectedBlockId: string | null,
  placementMode: "vertical" | "parallel" | "anchor",
): string | null {
  if (selectedBlockId) {
    return selectedBlockId;
  }
  if (placementMode === "vertical" && document.blocks.length > 0) {
    const top = document.blocks.reduce((best, block) =>
      block.position.y < best.position.y ? block : best,
    );
    return top.id;
  }
  return null;
}

function createBlockRecord(
  document: QABlockCanvasDocument,
  question: string,
  position: Vec2,
  groupId?: string,
): QABlock {
  const blockId = nextId("block");
  const resolvedGroupId = groupId ?? document.groups[0]?.id ?? "group-1";
  const snap = roundedPosition(position);
  return {
    id: blockId,
    kind: "qa_block",
    groupId: resolvedGroupId,
    question,
    answer: "",
    position: snap,
    snapPosition: snap,
    metadata: { stance: "neutral" },
    stack: {
      activeVersionId: `${blockId}-v1`,
      versions: [
        {
          id: `${blockId}-v1`,
          text: "",
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };
}

export function createBlockFromComposer(
  document: QABlockCanvasDocument,
  input: {
    question: string;
    selectedBlockId: string | null;
    anchor?: Vec2;
  },
): { document: QABlockCanvasDocument; blockId: string; parentBlockId: string | null } {
  const placement = resolveNewBlockPlacement({
    blocks: document.blocks,
    selectedBlockId: input.selectedBlockId,
    anchor: input.anchor,
  });
  const block = createBlockRecord(document, input.question, placement.position);
  const parentBlockId = contextParentId(document, input.selectedBlockId, placement.mode);
  const edges: ContextEdge[] = [...document.edges];
  if (parentBlockId) {
    edges.push({
      id: `edge-${parentBlockId}-${block.id}`,
      source: parentBlockId,
      target: block.id,
      meaning: "lineage",
    });
  }
  return {
    document: { ...document, blocks: [...document.blocks, block], edges },
    blockId: block.id,
    parentBlockId,
  };
}

export function createBlockAt(
  document: QABlockCanvasDocument,
  position: Vec2,
  question = "",
): { document: QABlockCanvasDocument; blockId: string } {
  const block = createBlockRecord(document, question, position);
  return {
    document: { ...document, blocks: [...document.blocks, block] },
    blockId: block.id,
  };
}

export function createBlockFromAction(
  document: QABlockCanvasDocument,
  input: {
    action: QABlockAnswerAction;
    selectedBlockId: string;
    anchor?: Vec2;
  },
): { document: QABlockCanvasDocument; blockId: string; parentBlockId: string | null } {
  return createBlockFromComposer(document, {
    question: actionQuestion(input.action),
    selectedBlockId: input.selectedBlockId,
    anchor: input.anchor,
  });
}

export { lineageParentId };
