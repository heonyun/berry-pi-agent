import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ImeTextarea, stopNodeKeyPropagation } from "./ImeTextarea.tsx";
import { compilePromptContext } from "../shared/compiler.ts";
import {
  VERTICAL_GAP,
  appendAnswerVersion,
  createInitialDocument,
  findNode,
  type AIAnswerNode,
  type ContextCanvasDocument,
  type ContextEdge,
  type ContextNode,
  type FeedbackState,
  type PromptInputNode,
  type StanceBand,
  updateNode,
} from "../shared/domain.ts";

type PromptNodeData = {
  nodeId: string;
  text: string;
  stance: StanceBand;
  running: boolean;
  onTextChange: (nodeId: string, text: string) => void;
  onRun: (nodeId: string, text?: string) => void;
};

type AnswerNodeData = {
  nodeId: string;
  text: string;
  stance: StanceBand;
  feedback?: FeedbackState;
  versionCount: number;
  running: boolean;
  onFeedback: (nodeId: string, feedback: FeedbackState) => void;
  onRetry: (nodeId: string) => void;
};

type CanvasNode = Node<PromptNodeData | AnswerNodeData>;

function stanceClass(stance: StanceBand): string {
  return `stance-${stance}`;
}

const PromptInputNode = memo(function PromptInputNode({ data }: NodeProps<Node<PromptNodeData>>) {
  const { nodeId, text, stance, running, onTextChange, onRun } = data;
  const latestTextRef = useRef(text);

  useEffect(() => {
    latestTextRef.current = text;
  }, [text]);

  const handleCommit = useCallback(
    (value: string) => {
      latestTextRef.current = value;
      onTextChange(nodeId, value);
    },
    [nodeId, onTextChange],
  );

  const handleLocalChange = useCallback((value: string) => {
    latestTextRef.current = value;
  }, []);

  const handleRun = useCallback(() => {
    const latest = latestTextRef.current;
    onTextChange(nodeId, latest);
    onRun(nodeId, latest);
  }, [nodeId, onRun, onTextChange]);

  return (
    <div className="node-card prompt">
      <Handle type="target" position={Position.Bottom} />
      <header>
        <span>Prompt</span>
        <span className={stanceClass(stance)}>{stance}</span>
      </header>
      <ImeTextarea
        className="nodrag nopan nowheel"
        value={text}
        onLocalChange={handleLocalChange}
        onValueChange={handleCommit}
        onKeyDown={stopNodeKeyPropagation}
        onKeyUp={stopNodeKeyPropagation}
        placeholder="Ask the agent..."
      />
      <div className="node-actions nodrag nopan">
        <button
          className="primary nodrag nopan"
          type="button"
          disabled={running}
          onKeyDown={stopNodeKeyPropagation}
          onClick={handleRun}
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>
      <Handle type="source" position={Position.Top} />
    </div>
  );
});

const AIAnswerNode = memo(function AIAnswerNode({ data }: NodeProps<Node<AnswerNodeData>>) {
  return (
    <div className="node-card answer">
      <Handle type="target" position={Position.Bottom} />
      <header>
        <span>AI Answer</span>
        <span className={stanceClass(data.stance)}>{data.stance}</span>
      </header>
      <div className="answer-text">{data.text || (data.running ? "Streaming..." : "No answer yet.")}</div>
      <div className="feedback-row nodrag nopan">
        {(["agree", "disagree", "unsure", "needs_retry"] as FeedbackState[]).map((feedback) => (
          <button
            key={feedback}
            type="button"
            className={`nodrag nopan ${data.feedback === feedback ? "active" : ""}`}
            onKeyDown={stopNodeKeyPropagation}
            onClick={() => data.onFeedback(data.nodeId, feedback)}
          >
            {feedback}
          </button>
        ))}
      </div>
      <div className="node-actions nodrag nopan">
        <button
          type="button"
          className="nodrag nopan"
          disabled={data.running}
          onKeyDown={stopNodeKeyPropagation}
          onClick={() => data.onRetry(data.nodeId)}
        >
          Retry (v{data.versionCount + 1})
        </button>
      </div>
      <Handle type="source" position={Position.Top} />
    </div>
  );
});

const nodeTypes = {
  promptInput: PromptInputNode,
  aiAnswer: AIAnswerNode,
};

function lineageParent(document: ContextCanvasDocument, promptNodeId: string): ContextNode | undefined {
  const edge = document.edges.find(
    (candidate) => candidate.target === promptNodeId && candidate.meaning === "lineage",
  );
  return edge ? findNode(document, edge.source) : undefined;
}

function stanceForNode(document: ContextCanvasDocument, node: ContextNode): StanceBand {
  if (node.kind === "prompt_input") {
    const parent = lineageParent(document, node.id);
    return parent ? compilePromptContext(document, node.id).stance : "neutral";
  }
  return node.metadata.stance ?? "neutral";
}

function nextId(prefix: string): string {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${id}`;
}

async function streamPrompt(
  document: ContextCanvasDocument,
  promptNodeId: string,
  onDelta: (delta: string) => void,
): Promise<void> {
  const response = await fetch("/api/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document, promptNodeId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part
        .split("\n")
        .find((entry) => entry.startsWith("data: "));
      if (!line) {
        continue;
      }
      const payload = JSON.parse(line.slice(6)) as
        | { type: "text_delta"; delta: string }
        | { type: "error"; message: string }
        | { type: "done" }
        | { type: "tool_start" }
        | { type: "tool_end" };
      if (payload.type === "text_delta") {
        onDelta(payload.delta);
      } else if (payload.type === "error") {
        throw new Error(payload.message);
      }
    }
  }
}

function ensureAnswerForPrompt(document: ContextCanvasDocument, promptId: string): {
  document: ContextCanvasDocument;
  answerId: string;
  created: boolean;
} {
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

function ensureNextPrompt(document: ContextCanvasDocument, answerId: string): ContextCanvasDocument {
  const answer = findNode(document, answerId);
  if (answer.kind !== "ai_answer") {
    return document;
  }

  const existing = document.edges.find(
    (edge) => edge.source === answerId && edge.meaning === "lineage",
  );
  if (existing) {
    return document;
  }

  const promptId = nextId("prompt");
  const prompt: PromptInputNode = {
    id: promptId,
    kind: "prompt_input",
    groupId: answer.groupId,
    text: "",
    position: { x: answer.position.x, y: answer.position.y - VERTICAL_GAP },
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

function CanvasApp() {
  const { fitView } = useReactFlow();
  const [document, setDocument] = useState<ContextCanvasDocument>(() => createInitialDocument());
  const documentRef = useRef(document);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("prompt-1");
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready");

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    void fitView({ padding: 0.2 });
  }, [fitView]);

  const updatePromptText = useCallback((nodeId: string, text: string) => {
    setDocument((current) =>
      updateNode(current, nodeId, (node) =>
        node.kind === "prompt_input" ? { ...node, text } : node,
      ),
    );
  }, []);

  const setAnswerText = useCallback((answerId: string, text: string) => {
    setDocument((current) =>
      updateNode(current, answerId, (node) => {
        if (node.kind !== "ai_answer") {
          return node;
        }
        const versions = node.stack?.versions ?? [];
        const activeId = node.stack?.activeVersionId;
        const nextVersions = versions.map((version) =>
          version.id === activeId ? { ...version, text } : version,
        );
        return {
          ...node,
          text,
          stack: {
            activeVersionId: activeId ?? `${node.id}-v1`,
            versions: nextVersions.length ? nextVersions : [{ id: `${node.id}-v1`, text, createdAt: new Date().toISOString() }],
          },
        };
      }),
    );
  }, []);

  const runPrompt = useCallback(
    async (promptNodeId: string, retryAnswerId?: string, promptTextOverride?: string) => {
      setRunningPromptId(promptNodeId);
      setStatus("Running agent...");

      let workingDocument =
        promptTextOverride === undefined
          ? documentRef.current
          : updateNode(documentRef.current, promptNodeId, (node) =>
              node.kind === "prompt_input" ? { ...node, text: promptTextOverride } : node,
            );
      let answerId = retryAnswerId;

      try {
        if (!answerId) {
          const prepared = ensureAnswerForPrompt(workingDocument, promptNodeId);
          workingDocument = prepared.document;
          answerId = prepared.answerId;
          documentRef.current = workingDocument;
          setDocument(workingDocument);
          setAnswerText(answerId, "");
        } else {
          const answer = findNode(workingDocument, answerId);
          if (answer.kind !== "ai_answer") {
            throw new Error("Retry target is not an answer node.");
          }
          const updatedAnswer = appendAnswerVersion(answer, {
            text: "",
            feedback: "needs_retry",
          });
          workingDocument = updateNode(workingDocument, answerId, () => updatedAnswer);
          documentRef.current = workingDocument;
          setDocument(workingDocument);
        }

        let streamed = "";
        await streamPrompt(workingDocument, promptNodeId, (delta) => {
          streamed += delta;
          setAnswerText(answerId!, streamed);
        });

        setDocument((current) => {
          const next = ensureNextPrompt(current, answerId!);
          documentRef.current = next;
          return next;
        });
        setStatus("Run complete");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Error: ${message}`);
      } finally {
        setRunningPromptId(null);
      }
    },
    [setAnswerText],
  );

  const onFeedback = useCallback((nodeId: string, feedback: FeedbackState) => {
    setDocument((current) =>
      updateNode(current, nodeId, (node) =>
        node.kind === "ai_answer" ? { ...node, feedback } : node,
      ),
    );
  }, []);

  const onRetry = useCallback(
    (answerId: string) => {
      const parentEdge = document.edges.find(
        (edge) => edge.target === answerId && edge.meaning === "lineage",
      );
      if (!parentEdge) {
        setStatus("Cannot retry: missing lineage parent.");
        return;
      }
      const parent = findNode(document, parentEdge.source);
      if (parent.kind !== "prompt_input") {
        setStatus("Cannot retry: parent is not a prompt.");
        return;
      }
      void runPrompt(parent.id, answerId);
    },
    [document, runPrompt],
  );

  const onNodeDragStop = useCallback((_: unknown, node: CanvasNode) => {
    setDocument((current) =>
      updateNode(current, node.id, (entry) => ({
        ...entry,
        position: { x: node.position.x, y: node.position.y },
      })),
    );
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }
    setDocument((current) => {
      const duplicate = current.edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.meaning === "context_reference",
      );
      if (duplicate) {
        return current;
      }
      const edge: ContextEdge = {
        id: `edge-ref-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        meaning: "context_reference",
      };
      return { ...current, edges: [...current.edges, edge] };
    });
  }, []);

  const runPromptById = useCallback(
    (promptNodeId: string, promptText?: string) => {
      void runPrompt(promptNodeId, undefined, promptText);
    },
    [runPrompt],
  );

  const flowNodes: CanvasNode[] = useMemo(
    () =>
      document.nodes.map((node) => {
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
              onTextChange: updatePromptText,
              onRun: runPromptById,
            },
          } satisfies CanvasNode;
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
            running: runningPromptId !== null && node.text === "" && node.stack?.versions.at(-1)?.text === "",
            onFeedback,
            onRetry,
          },
        } satisfies CanvasNode;
      }),
    [document, onFeedback, onRetry, runPromptById, runningPromptId, updatePromptText],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      document.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: edge.meaning === "context_reference",
        style: {
          stroke: edge.meaning === "context_reference" ? "#6ea8fe" : "#5f6c82",
          strokeDasharray: edge.meaning === "context_reference" ? "6 4" : undefined,
        },
        label: edge.meaning === "context_reference" ? "context" : "lineage",
      })),
    [document.edges],
  );

  const selectedNode = useMemo(() => {
    try {
      return findNode(document, selectedNodeId);
    } catch {
      return undefined;
    }
  }, [document, selectedNodeId]);

  const compiledPreview = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== "prompt_input") {
      return null;
    }
    try {
      return compilePromptContext(document, selectedNode.id);
    } catch {
      return null;
    }
  }, [document, selectedNode]);

  return (
    <div className="app-shell">
      <div className="canvas-panel">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          deleteKeyCode={null}
          panOnScroll={false}
          zoomOnScroll
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
        >
          <Background gap={18} color="#2a3140" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
      <aside className="side-panel">
        <div>
          <h2>Inspector</h2>
          <p className="status-line">{status}</p>
        </div>
        <div>
          <h3>Selected Node</h3>
          <pre>{selectedNode ? JSON.stringify(selectedNode, null, 2) : "None"}</pre>
        </div>
        <div>
          <h3>Compiled Preview</h3>
          <pre>{compiledPreview ? JSON.stringify(compiledPreview, null, 2) : "Select a prompt node"}</pre>
        </div>
      </aside>
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <CanvasApp />
    </ReactFlowProvider>
  );
}
