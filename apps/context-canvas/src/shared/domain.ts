export const VERTICAL_GAP = 240;
export const INITIAL_PROMPT_TEXT = "What should we explore on this canvas?";
export const DEFAULT_CANVAS_ID = "canvas-1";

export type StanceBand = "critical" | "neutral" | "constructive";
export type FeedbackState = "agree" | "disagree" | "unsure" | "needs_retry";
export type EdgeMeaning = "lineage" | "context_reference";
export type NodeKind = "prompt_input" | "ai_answer";

export interface Vec2 {
  x: number;
  y: number;
}

export interface AnswerVersion {
  id: string;
  text: string;
  createdAt: string;
  feedback?: FeedbackState;
}

export interface AnswerStack {
  activeVersionId: string;
  versions: AnswerVersion[];
}

export interface NodeMetadata {
  stance?: StanceBand;
}

export interface PromptInputNode {
  id: string;
  kind: "prompt_input";
  groupId: string;
  text: string;
  position: Vec2;
  metadata: NodeMetadata;
}

export interface AIAnswerNode {
  id: string;
  kind: "ai_answer";
  groupId: string;
  text: string;
  position: Vec2;
  metadata: NodeMetadata;
  feedback?: FeedbackState;
  stack?: AnswerStack;
}

export type ContextNode = PromptInputNode | AIAnswerNode;

export interface ContextEdge {
  id: string;
  source: string;
  target: string;
  meaning: EdgeMeaning;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ContextGroup {
  id: string;
  title: string;
  origin: Vec2;
}

export interface ContextCanvasDocument {
  schemaVersion: 1;
  canvas: { id: string; title: string };
  groups: ContextGroup[];
  nodes: ContextNode[];
  edges: ContextEdge[];
}

export function calculateStanceBand(
  promptPosition: Vec2,
  referencePosition: Vec2,
  threshold = 140,
): StanceBand {
  const dx = promptPosition.x - referencePosition.x;
  if (dx <= -threshold) {
    return "critical";
  }
  if (dx >= threshold) {
    return "constructive";
  }
  return "neutral";
}

export function appendAnswerVersion(
  node: AIAnswerNode,
  version: { text: string; createdAt?: string; feedback?: FeedbackState },
): AIAnswerNode {
  const existingVersions = node.stack?.versions ?? [];
  const nextVersionNumber = existingVersions.length + 1;
  const nextVersion: AnswerVersion = {
    id: `${node.id}-v${nextVersionNumber}`,
    text: version.text,
    createdAt: version.createdAt ?? new Date().toISOString(),
    feedback: version.feedback,
  };
  return {
    ...node,
    text: version.text,
    feedback: version.feedback ?? node.feedback,
    stack: {
      activeVersionId: nextVersion.id,
      versions: [...existingVersions, nextVersion],
    },
  };
}

export function createInitialDocument(): ContextCanvasDocument {
  return {
    schemaVersion: 1,
    canvas: {
      id: DEFAULT_CANVAS_ID,
      title: "Context Canvas MVP",
    },
    groups: [
      {
        id: "group-1",
        title: "Conversation",
        origin: { x: 0, y: 0 },
      },
    ],
    nodes: [
      {
        id: "prompt-1",
        kind: "prompt_input",
        groupId: "group-1",
        text: INITIAL_PROMPT_TEXT,
        position: { x: 0, y: 0 },
        metadata: { stance: "neutral" },
      },
    ],
    edges: [],
  };
}

export function findNode(document: ContextCanvasDocument, nodeId: string): ContextNode {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new Error(`Unknown node: ${nodeId}`);
  }
  return node;
}

export function updateNode(
  document: ContextCanvasDocument,
  nodeId: string,
  updater: (node: ContextNode) => ContextNode,
): ContextCanvasDocument {
  return {
    ...document,
    nodes: document.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
  };
}
