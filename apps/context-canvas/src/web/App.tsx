import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  connectionToContextReferenceCommand,
  toReactFlowEdges,
  toReactFlowNodes,
  type CanvasFlowNode,
} from "../adapters/react-flow.ts";
import type { CanvasCommand } from "../core/commands.ts";
import { findLineageParentPromptId, roundedPosition } from "../core/mutations.ts";
import { applyCommand } from "../core/reducer.ts";
import { compilePromptContext } from "../shared/compiler.ts";
import { buildNodeBacklinks, formatCompiledPreviewMarkdown } from "../shared/compile-preview.ts";
import { createInitialDocument, findNode } from "../shared/domain.ts";
import { canvasNodeTypes } from "./canvas-nodes.tsx";
import { exportBundle } from "./export-bundle.ts";
import { streamPrompt } from "./stream-prompt.ts";

function CanvasApp() {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [document, setDocument] = useState(() => createInitialDocument());
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

  const dispatch = useCallback((command: CanvasCommand) => {
    const result = applyCommand(documentRef.current, command);
    documentRef.current = result.document;
    setDocument(result.document);
    if (result.meta.createdAnswer) {
      fitViewOnLayoutRef.current = true;
    }
    if (result.meta.promptId) {
      setSelectedNodeId(result.meta.promptId);
    }
    if (result.meta.statusMessage) {
      setStatus(result.meta.statusMessage);
    }
    return result;
  }, []);

  const updatePromptDraft = useCallback((nodeId: string, text: string) => {
    promptDraftsRef.current.set(nodeId, text);
  }, []);

  const updatePromptText = useCallback(
    (nodeId: string, text: string) => {
      promptDraftsRef.current.set(nodeId, text);
      dispatch({ type: "update_prompt_text", nodeId, text });
    },
    [dispatch],
  );

  const setAnswerText = useCallback(
    (answerId: string, text: string) => {
      dispatch({ type: "set_answer_text", answerId, text });
    },
    [dispatch],
  );

  const saveBundle = useCallback(async (promptNodeId?: string) => {
    try {
      const result = await exportBundle(documentRef.current, promptNodeId);
      const fileCount = result.pathsWritten.length;
      const errorCount = result.errors.length;
      if (errorCount > 0) {
        setStatus(`Bundle saved (${fileCount} files, ${errorCount} warnings).`);
        return;
      }
      setStatus(`Bundle saved (${fileCount} files).`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Bundle export failed: ${message}`);
    }
  }, []);

  const runPrompt = useCallback(
    async (promptNodeId: string, retryAnswerId?: string, promptTextOverride?: string) => {
      setRunningPromptId(promptNodeId);
      setStatus("Running agent...");

      const latestPromptText = promptTextOverride ?? promptDraftsRef.current.get(promptNodeId);
      if (latestPromptText !== undefined) {
        dispatch({ type: "update_prompt_text", nodeId: promptNodeId, text: latestPromptText });
      }

      let answerId = retryAnswerId;

      try {
        if (!answerId) {
          const prepared = dispatch({ type: "ensure_answer_for_prompt", promptId: promptNodeId });
          answerId = prepared.meta.answerId;
          if (!answerId) {
            throw new Error("Failed to prepare answer node.");
          }
          setAnswerText(answerId, "");
        } else {
          dispatch({ type: "prepare_answer_retry", answerId });
        }

        let streamed = "";
        await streamPrompt(documentRef.current, promptNodeId, (delta) => {
          streamed += delta;
          setAnswerText(answerId!, streamed);
        });

        await saveBundle(promptNodeId);
        setStatus("Answer complete. Next prompt will appear...");
        window.setTimeout(() => {
          dispatch({ type: "ensure_next_prompt", answerId: answerId! });
          void saveBundle();
        }, 3000);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Error: ${message}`);
      } finally {
        setRunningPromptId(null);
      }
    },
    [dispatch, saveBundle, setAnswerText],
  );

  const onFeedback = useCallback(
    (nodeId: string, feedback: import("../shared/domain.ts").FeedbackState) => {
      dispatch({ type: "set_feedback", nodeId, feedback });
    },
    [dispatch],
  );

  const onRetry = useCallback(
    (answerId: string) => {
      const parentPromptId = findLineageParentPromptId(documentRef.current, answerId);
      if (!parentPromptId) {
        setStatus("Cannot retry: missing lineage parent.");
        return;
      }
      void runPrompt(parentPromptId, answerId, promptDraftsRef.current.get(parentPromptId));
    },
    [runPrompt],
  );

  const updateDraggedNodePosition = useCallback(
    (node: CanvasFlowNode) => {
      dispatch({
        type: "move_node",
        nodeId: node.id,
        position: roundedPosition(node.position),
      });
    },
    [dispatch],
  );

  const onBranch = useCallback(
    (answerId: string, direction: "critical" | "constructive") => {
      dispatch({ type: "branch_from_answer", answerId, direction });
    },
    [dispatch],
  );

  const onPaneClick = useCallback(
    (event: MouseEvent) => {
      if (event.detail !== 2) {
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      dispatch({ type: "create_prompt_at", position });
    },
    [dispatch, screenToFlowPosition],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const command = connectionToContextReferenceCommand(connection);
      if (!command) {
        return;
      }
      dispatch({ type: "connect_context_reference", ...command });
    },
    [dispatch],
  );

  const runPromptById = useCallback(
    (promptNodeId: string, promptText?: string) => {
      void runPrompt(promptNodeId, undefined, promptText);
    },
    [runPrompt],
  );

  const flowNodes = useMemo(
    () =>
      toReactFlowNodes({
        document,
        runningPromptId,
        callbacks: {
          onDraftChange: updatePromptDraft,
          onTextChange: updatePromptText,
          onRun: runPromptById,
          onFeedback,
          onBranch,
          onRetry,
        },
      }),
    [document, onBranch, onFeedback, onRetry, runPromptById, runningPromptId, updatePromptDraft, updatePromptText],
  );

  const flowEdges = useMemo(() => toReactFlowEdges(document), [document]);

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

  const compiledPreviewMarkdown = useMemo(() => {
    if (!compiledPreview) {
      return null;
    }
    return formatCompiledPreviewMarkdown(compiledPreview);
  }, [compiledPreview]);

  const backlinks = useMemo(() => {
    if (!selectedNode) {
      return [];
    }
    return buildNodeBacklinks(document, selectedNode.id);
  }, [document, selectedNode]);

  return (
    <div className="app-shell">
      <div className="canvas-panel">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={canvasNodeTypes}
          deleteKeyCode={null}
          panOnScroll={false}
          zoomOnScroll
          zoomOnDoubleClick={false}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onNodeDrag={(_, node) => updateDraggedNodePosition(node as CanvasFlowNode)}
          onNodeDragStop={(_, node) => updateDraggedNodePosition(node as CanvasFlowNode)}
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
          <pre>
            {selectedNode
              ? `${selectedNode.kind} · ${selectedNode.id}\n\n${selectedNode.text}`
              : "None"}
          </pre>
        </div>
        <div>
          <h3>Compiled Preview</h3>
          <pre className="markdown-preview">
            {compiledPreviewMarkdown ?? "Select a prompt node"}
          </pre>
        </div>
        <div>
          <h3>Backlinks</h3>
          {backlinks.length === 0 ? (
            <p className="muted-line">No backlinks for this node.</p>
          ) : (
            <ul className="backlink-list">
              {backlinks.map((backlink) => (
                <li key={`${backlink.reason}-${backlink.nodeId}`}>
                  <button type="button" className="backlink-button" onClick={() => setSelectedNodeId(backlink.nodeId)}>
                    {backlink.nodeId}
                  </button>
                  <span className="backlink-reason">{backlink.reason}</span>
                </li>
              ))}
            </ul>
          )}
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
