import {
  VERTICAL_GAP,
  appendAnswerVersion,
  findNode,
  type AIAnswerNode,
  type ContextCanvasDocument,
  type ContextEdge,
  type ContextNode,
  type PromptInputNode,
  type Vec2,
} from "../shared/domain.ts";
import type { BranchDirection } from "./commands.ts";

export function nextId(prefix: string): string {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${id}`;
}

export function roundedPosition(position: Vec2): Vec2 {
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

export function ensureAnswerForPrompt(
  document: ContextCanvasDocument,
  promptId: string,
): { document: ContextCanvasDocument; answerId: string; created: boolean } {
  const prompt = findNode(document, promptId);
  if (prompt.kind !== "prompt_input") {
    throw new Error("Only prompt nodes can be run.");
  }

  const existing = document.edges.find(
    (edge) => edge.source === promptId && edge.meaning === "lineage",
  );
  if (existing) {
    return { document, answerId: existing.target, created: false };
  }

  const answerId = nextId("answer");
  const answer: AIAnswerNode = {
    id: answerId,
    kind: "ai_answer",
    groupId: prompt.groupId,
    text: "",
    position: { x: prompt.position.x, y: prompt.position.y - VERTICAL_GAP },
    metadata: { stance: "neutral" },
    stack: {
      activeVersionId: `${answerId}-v1`,
      versions: [
        {
          id: `${answerId}-v1`,
          text: "",
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };

  const edge: ContextEdge = {
    id: `edge-${promptId}-${answerId}`,
    source: promptId,
    target: answerId,
    meaning: "lineage",
  };

  return {
    document: {
      ...document,
      nodes: [...document.nodes, answer],
      edges: [...document.edges, edge],
    },
    answerId,
    created: true,
  };
}

export function ensureNextPrompt(document: ContextCanvasDocument, answerId: string): ContextCanvasDocument {
  const answer = findNode(document, answerId);
  if (answer.kind !== "ai_answer") {
    return document;
  }

  const autoPromptPosition = {
    x: answer.position.x,
    y: answer.position.y - VERTICAL_GAP,
  };
  const existingAutoPrompt = document.edges.some((edge) => {
    if (edge.source !== answerId || edge.meaning !== "lineage") {
      return false;
    }
    const target = findNode(document, edge.target);
    return target.position.x === autoPromptPosition.x && target.position.y === autoPromptPosition.y;
  });
  if (existingAutoPrompt) {
    return document;
  }

  const promptId = nextId("prompt");
  const prompt: PromptInputNode = {
    id: promptId,
    kind: "prompt_input",
    groupId: answer.groupId,
    text: "",
    position: autoPromptPosition,
    metadata: { stance: "neutral" },
  };

  const edge: ContextEdge = {
    id: `edge-${answerId}-${promptId}`,
    source: answerId,
    target: promptId,
    meaning: "lineage",
  };

  const contextRef: ContextEdge = {
    id: `edge-ref-${answerId}-${promptId}`,
    source: answerId,
    target: promptId,
    meaning: "context_reference",
  };

  return {
    ...document,
    nodes: [...document.nodes, prompt],
    edges: [...document.edges, edge, contextRef],
  };
}

export function createPromptAt(
  document: ContextCanvasDocument,
  position: Vec2,
  parentAnswerId?: string,
): { document: ContextCanvasDocument; promptId: string } {
  const promptId = nextId("prompt");
  const parentAnswer = parentAnswerId ? findNode(document, parentAnswerId) : undefined;
  const prompt: PromptInputNode = {
    id: promptId,
    kind: "prompt_input",
    groupId: parentAnswer?.groupId ?? document.groups[0]?.id ?? "group-1",
    text: "",
    position: roundedPosition(position),
    metadata: { stance: "neutral" },
  };
  const nodes = [...document.nodes, prompt];
  const edges: ContextEdge[] = [...document.edges];

  if (parentAnswer?.kind === "ai_answer") {
    edges.push({
      id: `edge-${parentAnswer.id}-${promptId}`,
      source: parentAnswer.id,
      target: promptId,
      meaning: "lineage",
    });
    edges.push({
      id: `edge-ref-${parentAnswer.id}-${promptId}`,
      source: parentAnswer.id,
      target: promptId,
      meaning: "context_reference",
    });
  }

  return { document: { ...document, nodes, edges }, promptId };
}

export function branchFromAnswer(
  document: ContextCanvasDocument,
  answerId: string,
  direction: BranchDirection,
): { document: ContextCanvasDocument; promptId: string } {
  const answer = findNode(document, answerId);
  if (answer.kind !== "ai_answer") {
    throw new Error("Branch source is not an answer node.");
  }
  const xOffset = direction === "critical" ? -360 : 360;
  return createPromptAt(
    document,
    { x: answer.position.x + xOffset, y: answer.position.y },
    answerId,
  );
}

export function lineageParent(
  document: ContextCanvasDocument,
  promptNodeId: string,
): ContextNode | undefined {
  const edge = document.edges.find(
    (candidate) => candidate.target === promptNodeId && candidate.meaning === "lineage",
  );
  return edge ? findNode(document, edge.source) : undefined;
}

export function findLineageParentPromptId(
  document: ContextCanvasDocument,
  answerId: string,
): string | undefined {
  const parentEdge = document.edges.find(
    (edge) => edge.target === answerId && edge.meaning === "lineage",
  );
  if (!parentEdge) {
    return undefined;
  }
  const parent = findNode(document, parentEdge.source);
  return parent.kind === "prompt_input" ? parent.id : undefined;
}
