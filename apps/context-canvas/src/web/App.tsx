import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ImeTextarea, stopNodeKeyPropagation } from "./ImeTextarea.tsx";
import { compilePromptContext } from "../shared/compiler.ts";
import {
  INITIAL_PROMPT_TEXT,
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
  onDraftChange: (nodeId: string, text: string) => void;
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
  onBranch: (nodeId: string, direction: "critical" | "constructive") => void;
  onRetry: (nodeId: string) => void;
};

type CanvasNode = Node<PromptNodeData | AnswerNodeData>;

function stanceClass(stance: StanceBand): string {
  return `stance-${stance}`;
}

const PromptInputNode = memo(function PromptInputNode({ data, dragging }: NodeProps<Node<PromptNodeData>>) {
  const { nodeId, text, stance, running, onDraftChange, onTextChange, onRun } = data;
  const latestTextRef = useRef(text);

  useEffect(() => {
    latestTextRef.current = text;
  }, [text]);

  const handleCommit = useCallback(
    (value: string) => {
      latestTextRef.current = value;
      onDraftChange(nodeId, value);
      onTextChange(nodeId, value);
    },
    [nodeId, onDraftChange, onTextChange],
  );

  const handleLocalChange = useCallback(
    (value: string) => {
      latestTextRef.current = value;
      onDraftChange(nodeId, value);
    },
    [nodeId, onDraftChange],
  );

  const handleRun = useCallback(() => {
    const latest = latestTextRef.current;
    onDraftChange(nodeId, latest);
    onTextChange(nodeId, latest);
    onRun(nodeId, latest);
  }, [nodeId, onDraftChange, onRun, onTextChange]);

  return (
    <div className={`node-card prompt ${dragging ? "dragging" : ""}`}>
      <Handle type="target" position={Position.Bottom} />
      <header>
        <span>Prompt</span>
        <span className={stanceClass(stance)}>{stance}</span>
      </header>
      <ImeTextarea
        className="nodrag nopan nowheel"
        value={text}
        clearOnFocusValue={INITIAL_PROMPT_TEXT}
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

const AIAnswerNode = memo(function AIAnswerNode({ data, dragging }: NodeProps<Node<AnswerNodeData>>) {
  return (
    <div className={`node-card answer ${dragging ? "dragging" : ""}`}>
      <Handle type="target" position={Position.Bottom} />
      <button
        type="button"
        className="branch-button branch-left nodrag nopan"
        title="Create a critical follow-up prompt"
        onKeyDown={stopNodeKeyPropagation}
        onClick={(event) => {
          event.stopPropagation();
          data.onBranch(data.nodeId, "critical");
        }}
      >
        Critique
      </button>
      <button
        type="button"
        className="branch-button branch-right nodrag nopan"
        title="Create a constructive follow-up prompt"
        onKeyDown={stopNodeKeyPropagation}
        onClick={(event) => {
          event.stopPropagation();
          data.onBranch(data.nodeId, "constructive");
        }}
      >
        Build
      </button>
      <header>
        <span>AI Answer</span>
        <span className={stanceClass(data.stance)}>{data.stance}</span>
      </header>
      <div className="answer-text">
        {data.text || (data.running ? <span className="streaming-dot" aria-label="Streaming answer" /> : "No answer yet.")}
      </div>
      <div className="feedback-row nodrag nopan">
        {(["agree", "disagree", "unsure"] as FeedbackState[]).map((feedback) => (
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
          Regenerate answer (v{data.versionCount + 1})
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

function roundedPosition(position: XYPosition): XYPosition {
  return { x: Math.round(position.x), y: Math.round(position.y) };
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

function createPromptAt(
  document: ContextCanvasDocument,
  position: XYPosition,
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

function CanvasApp() {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [document, setDocument] = useState<ContextCanvasDocument>(() => createInitialDocument());
  const documentRef = useRef(document);
  const promptDraftsRef = useRef(new Map<string, string>());
  const fitViewOnLayoutRef = useRef(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("prompt-1");
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready");
  const nodeCount = document.nodes.length;
  const edgeCount = document.edges.length;

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    if (!fitViewOnLayoutRef.current) {
      return;
    }
    fitViewOnLayoutRef.current = false;
    void fitView({ padding: 0.2, duration: 180 });
  }, [edgeCount, fitView, nodeCount]);

  const updatePromptDraft = useCallback((nodeId: string, text: string) => {
    promptDraftsRef.current.set(nodeId, text);
  }, []);

  const updatePromptText = useCallback((nodeId: string, text: string) => {
    promptDraftsRef.current.set(nodeId, text);
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

      const latestPromptText = promptTextOverride ?? promptDraftsRef.current.get(promptNodeId);
      let workingDocument =
        latestPromptText === undefined
          ? documentRef.current
          : updateNode(documentRef.current, promptNodeId, (node) =>
              node.kind === "prompt_input" ? { ...node, text: latestPromptText } : node,
            );
      let answerId = retryAnswerId;

      try {
        if (!answerId) {
          const prepared = ensureAnswerForPrompt(workingDocument, promptNodeId);
          workingDocument = prepared.document;
          answerId = prepared.answerId;
          documentRef.current = workingDocument;
          if (prepared.created) {
            fitViewOnLayoutRef.current = true;
          }
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

        setStatus("Answer complete. Next prompt will appear...");
        window.setTimeout(() => {
          const next = ensureNextPrompt(documentRef.current, answerId!);
          const nextPrompt = next.edges.find(
            (edge) => edge.source === answerId && edge.meaning === "lineage",
          );
          documentRef.current = next;
          setDocument(next);
          if (nextPrompt) {
            setSelectedNodeId(nextPrompt.target);
          }
          setStatus("Run complete");
        }, 3000);
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
      void runPrompt(parent.id, answerId, promptDraftsRef.current.get(parent.id));
    },
    [document, runPrompt],
  );

  const updateDraggedNodePosition = useCallback((node: CanvasNode) => {
    setDocument((current) => {
      const next = updateNode(current, node.id, (entry) => ({
        ...entry,
        position: roundedPosition(node.position),
      }));
      documentRef.current = next;
      return next;
    });
  }, []);

  const onBranch = useCallback((answerId: string, direction: "critical" | "constructive") => {
    const answer = findNode(documentRef.current, answerId);
    if (answer.kind !== "ai_answer") {
      return;
    }
    const xOffset = direction === "critical" ? -360 : 360;
    const created = createPromptAt(
      documentRef.current,
      { x: answer.position.x + xOffset, y: answer.position.y },
      answerId,
    );
    documentRef.current = created.document;
    setDocument(created.document);
    setSelectedNodeId(created.promptId);
    setStatus(direction === "critical" ? "Critical follow-up prompt created" : "Constructive follow-up prompt created");
  }, []);

  const onPaneClick = useCallback(
    (event: MouseEvent) => {
      if (event.detail !== 2) {
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const created = createPromptAt(documentRef.current, position);
      documentRef.current = created.document;
      setDocument(created.document);
      setSelectedNodeId(created.promptId);
      setStatus("New prompt created");
    },
    [screenToFlowPosition],
  );

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
              onDraftChange: updatePromptDraft,
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
            onBranch,
            onRetry,
          },
        } satisfies CanvasNode;
      }),
    [document, onBranch, onFeedback, onRetry, runPromptById, runningPromptId, updatePromptDraft, updatePromptText],
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
          zoomOnDoubleClick={false}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onNodeDrag={(_, node) => updateDraggedNodePosition(node)}
          onNodeDragStop={(_, node) => updateDraggedNodePosition(node)}
          onPaneClick={onPaneClick}
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
