import type { Connection, Edge, Node } from "@xyflow/react";
import type { ContextCanvasDocument, FeedbackState, StanceBand } from "../shared/domain.ts";
import { stanceForNode } from "../core/stance.ts";

export type AnswerAction = "risks" | "positives" | "risk_retry";

export interface PromptNodeData {
  nodeId: string;
  text: string;
  stance: StanceBand;
  running: boolean;
  interactionDisabled: boolean;
  onDraftChange: (nodeId: string, text: string) => void;
  onTextChange: (nodeId: string, text: string) => void;
  onRun: (nodeId: string, text?: string) => void;
  deleteArmed: boolean;
  isNew: boolean;
  onArmDelete: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  [key: string]: unknown;
}

export interface AnswerNodeData {
  nodeId: string;
  text: string;
  stance: StanceBand;
  feedback?: FeedbackState;
  versionCount: number;
  running: boolean;
  interactionDisabled: boolean;
  deleteArmed: boolean;
  isNew: boolean;
  selected?: boolean;
  multiSelected?: boolean;
  onFeedback: (nodeId: string, feedback: FeedbackState) => void;
  onArmDelete: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onRetry: (nodeId: string) => void;
  onAnswerAction: (nodeId: string, action: AnswerAction) => void;
  [key: string]: unknown;
}

export type CanvasFlowNode = Node<PromptNodeData | AnswerNodeData>;

export interface ReactFlowAdapterInput {
  document: ContextCanvasDocument;
  runningPromptId: string | null;
  interactionDisabled?: boolean;
  callbacks: {
    onDraftChange: PromptNodeData["onDraftChange"];
    onTextChange: PromptNodeData["onTextChange"];
    onRun: PromptNodeData["onRun"];
    onArmDelete: PromptNodeData["onArmDelete"];
    onDelete: PromptNodeData["onDelete"];
    onFeedback: AnswerNodeData["onFeedback"];
    onRetry: AnswerNodeData["onRetry"];
    onAnswerAction: AnswerNodeData["onAnswerAction"];
  };
  deleteArmedNodeId?: string | null;
  newNodeIds?: ReadonlySet<string>;
  selectedNodeIds?: ReadonlySet<string>;
}

export function toReactFlowNodes(input: ReactFlowAdapterInput): CanvasFlowNode[] {
  const {
    document,
    runningPromptId,
    interactionDisabled = false,
    callbacks,
    deleteArmedNodeId,
    newNodeIds,
    selectedNodeIds,
  } = input;
  return document.nodes.map((node) => {
    const stance = stanceForNode(document, node);
    if (node.kind === "prompt_input") {
      return {
        id: node.id,
        type: "promptInput",
        position: node.position,
        dragHandle: ".node-drag-handle",
        data: {
          nodeId: node.id,
          text: node.text,
          stance,
          running: runningPromptId === node.id,
          interactionDisabled,
          deleteArmed: deleteArmedNodeId === node.id,
          isNew: newNodeIds?.has(node.id) ?? false,
          onDraftChange: callbacks.onDraftChange,
          onTextChange: callbacks.onTextChange,
          onRun: callbacks.onRun,
          onArmDelete: callbacks.onArmDelete,
          onDelete: callbacks.onDelete,
        },
      } satisfies CanvasFlowNode;
    }

    return {
      id: node.id,
      type: "aiAnswer",
      position: node.position,
      dragHandle: ".node-drag-handle",
      data: {
        nodeId: node.id,
        text: node.text,
        stance,
        feedback: node.feedback,
        versionCount: node.stack?.versions.length ?? 1,
        interactionDisabled,
        running:
          runningPromptId !== null &&
          node.text === "" &&
          node.stack?.versions.at(-1)?.text === "",
        deleteArmed: deleteArmedNodeId === node.id,
        isNew: newNodeIds?.has(node.id) ?? false,
        selected: selectedNodeIds?.has(node.id) ?? false,
        multiSelected: (selectedNodeIds?.size ?? 0) > 1,
        onFeedback: callbacks.onFeedback,
        onArmDelete: callbacks.onArmDelete,
        onDelete: callbacks.onDelete,
        onRetry: callbacks.onRetry,
        onAnswerAction: callbacks.onAnswerAction,
      },
    } satisfies CanvasFlowNode;
  });
}

export function toReactFlowEdges(document: ContextCanvasDocument): Edge[] {
  return document.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    animated: edge.meaning === "context_reference",
    style: {
      stroke:
        edge.meaning === "context_reference"
          ? "var(--edge-context, #6d88a1)"
          : "var(--edge-lineage, #9d8f84)",
      strokeDasharray: edge.meaning === "context_reference" ? "6 4" : undefined,
    },
    label: edge.meaning === "context_reference" ? "context" : "lineage",
  }));
}

export function connectionToContextReferenceCommand(connection: Connection): {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
} | undefined {
  if (!connection.source || !connection.target) {
    return undefined;
  }
  return {
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    targetHandle: connection.targetHandle ?? undefined,
  };
}
