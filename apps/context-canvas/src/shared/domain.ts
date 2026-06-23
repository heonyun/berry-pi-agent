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
  summary?: string;
  updatedAt?: string;
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
        summary: "",
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

export function normalizeDocument(document: ContextCanvasDocument): ContextCanvasDocument {
  return {
    ...document,
    groups: document.groups.map((group) => ({
      ...group,
      summary: group.summary ?? "",
    })),
  };
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

/** WHY: schema v2 is a clean break from prompt_input + ai_answer pairs; v1 converter is deferred. */
export const QA_BLOCK_SCHEMA_VERSION = 2 as const;
/** WHY: v2 blocks are ~50% larger than v1 nodes (320×180); gap scales with block size (issue-39). */
export const QA_BLOCK_APPROX_WIDTH = 480;
export const QA_BLOCK_APPROX_HEIGHT = 270;
export const QA_BLOCK_VERTICAL_GAP = 360;
export const QA_BLOCK_HORIZONTAL_GAP = 540;
export const QA_BLOCK_COLUMN_TOLERANCE = 72;
/** TODO: issue-39 — tentative snap/detach threshold; confirm in manual UX pass. */
export const QA_BLOCK_MAGNETIC_DETACH_THRESHOLD = 30;

export interface QABlock {
  id: string;
  kind: "qa_block";
  groupId: string;
  question: string;
  answer: string;
  position: Vec2;
  /** Magnetic anchor; edges show when position drifts beyond detach threshold. */
  snapPosition: Vec2;
  metadata: NodeMetadata;
  stack?: AnswerStack;
}

export interface QABlockCanvasDocument {
  schemaVersion: typeof QA_BLOCK_SCHEMA_VERSION;
  canvas: { id: string; title: string };
  groups: ContextGroup[];
  blocks: QABlock[];
  edges: ContextEdge[];
}

/** Minimal canvas sidecar for Obsidian/external-tool observability (viewport optional). */
export interface CanvasSidecar {
  id: string;
  title: string;
  schemaVersion: typeof QA_BLOCK_SCHEMA_VERSION;
  viewport?: { x: number; y: number; zoom: number };
}

/** TODO: issue-39 — replace v1 initial document once App reads v2 only. */
export function createEmptyQABlockDocument(): QABlockCanvasDocument {
  return {
    schemaVersion: QA_BLOCK_SCHEMA_VERSION,
    canvas: { id: DEFAULT_CANVAS_ID, title: "Context Canvas" },
    groups: [
      {
        id: "group-1",
        title: "Conversation",
        origin: { x: 0, y: 0 },
        summary: "",
      },
    ],
    blocks: [],
    edges: [],
  };
}

export function findQABlock(document: QABlockCanvasDocument, blockId: string): QABlock {
  const block = document.blocks.find((candidate) => candidate.id === blockId);
  if (!block) {
    throw new Error(`Unknown qa_block: ${blockId}`);
  }
  return block;
}

export function updateQABlock(
  document: QABlockCanvasDocument,
  blockId: string,
  updater: (block: QABlock) => QABlock,
): QABlockCanvasDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
  };
}

export function appendQABlockAnswerVersion(
  block: QABlock,
  version: { text: string; createdAt?: string },
): QABlock {
  const existingVersions = block.stack?.versions ?? [];
  const nextVersionNumber = existingVersions.length + 1;
  const nextVersion: AnswerVersion = {
    id: `${block.id}-v${nextVersionNumber}`,
    text: version.text,
    createdAt: version.createdAt ?? new Date().toISOString(),
  };
  return {
    ...block,
    answer: version.text,
    stack: {
      activeVersionId: nextVersion.id,
      versions: [...existingVersions, nextVersion],
    },
  };
}
