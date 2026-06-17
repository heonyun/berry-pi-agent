import type { Connection, Edge, Node } from "@xyflow/react";
import type { ContextCanvasDocument, FeedbackState, StanceBand } from "../shared/domain.ts";
import { stanceForNode } from "../core/stance.ts";

export type BranchDirection = "critical" | "constructive";

export interface PromptNodeData {
  nodeId: string;
  text: string;
  stance: StanceBand;
  running: boolean;
  onDraftChange: (nodeId: string, text: string) => void;
  onTextChange: (nodeId: string, text: string) => void;
  onRun: (nodeId: string, text?: string) => void;
  [key: string]: unknown;
}

export interface AnswerNodeData {
  nodeId: string;
  text: string;
  stance: StanceBand;
  feedback?: FeedbackState;
  versionCount: number;
  running: boolean;
  onFeedback: (nodeId: string, feedback: FeedbackState) => void;
  onBranch: (nodeId: string, direction: BranchDirection) => void;
  onRetry: (nodeId: string) => void;
  [key: string]: unknown;
}

export type CanvasFlowNode = Node<PromptNodeData | AnswerNodeData>;

export interface ReactFlowAdapterInput {
  document: ContextCanvasDocument;
  runningPromptId: string | null;
  callbacks: {
    onDraftChange: PromptNodeData["onDraftChange"];
    onTextChange: PromptNodeData["onTextChange"];
    onRun: PromptNodeData["onRun"];
    onFeedback: AnswerNodeData["onFeedback"];
    onBranch: AnswerNodeData["onBranch"];
    onRetry: AnswerNodeData["onRetry"];
  };
}

export function toReactFlowNodes(input: ReactFlowAdapterInput): CanvasFlowNode[] {
  const { document, runningPromptId, callbacks } = input;
  return document.nodes.map((node) => {
    const stance = stanceForNode(document, node);
    if (node.kind === "prompt_input") {
      return {
        id: node.id,
        type: "promptInput",
        position: node.position,
        data: {
          nodeId: node.id,
          text: node.text,
          stance,
          running: runningPromptId === node.id,
          onDraftChange: callbacks.onDraftChange,
          onTextChange: callbacks.onTextChange,
          onRun: callbacks.onRun,
        },
      } satisfies CanvasFlowNode;
    }

    return {
      id: node.id,
      type: "aiAnswer",
      position: node.position,
      data: {
        nodeId: node.id,
        text: node.text,
        stance,
        feedback: node.feedback,
        versionCount: node.stack?.versions.length ?? 1,
        running:
          runningPromptId !== null &&
          node.text === "" &&
          node.stack?.versions.at(-1)?.text === "",
        onFeedback: callbacks.onFeedback,
        onBranch: callbacks.onBranch,
        onRetry: callbacks.onRetry,
      },
    } satisfies CanvasFlowNode;
  });
}

export function toReactFlowEdges(document: ContextCanvasDocument): Edge[] {
  return document.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.meaning === "context_reference",
    style: {
      stroke: edge.meaning === "context_reference" ? "#6ea8fe" : "#5f6c82",
      strokeDasharray: edge.meaning === "context_reference" ? "6 4" : undefined,
    },
    label: edge.meaning === "context_reference" ? "context" : "lineage",
  }));
}

export function connectionToContextReferenceCommand(connection: Connection): {
  source: string;
  target: string;
} | undefined {
  if (!connection.source || !connection.target) {
    return undefined;
  }
  return { source: connection.source, target: connection.target };
}
