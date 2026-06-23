import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  toQABlockFlowEdges,
  toQABlockFlowNodes,
  type QABlockFlowNode,
} from "../adapters/qa-block-react-flow.ts";
import type { AnswerAction } from "../adapters/react-flow.ts";
import type { QABlockCommand } from "../core/qa-block-commands.ts";
import { applyQABlockCommand } from "../core/qa-block-reducer.ts";
import { roundedPosition } from "../core/mutations.ts";
import { compileQABlockContext } from "../shared/compile-qablock-context.ts";
import { createEmptyQABlockDocument } from "../shared/domain.ts";
import { BottomComposer } from "./BottomComposer.tsx";
import { canvasNodeTypes } from "./canvas-nodes.tsx";
import { streamBlock } from "./stream-block.ts";

function QABlockCanvasApp() {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [document, setDocument] = useState(() => createEmptyQABlockDocument());
  const documentRef = useRef(document);
  const fitViewOnLayoutRef = useRef(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [deleteArmedBlockId, setDeleteArmedBlockId] = useState<string | null>(null);
  const [runningBlockId, setRunningBlockId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const blockCount = document.blocks.length;

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    if (!fitViewOnLayoutRef.current || blockCount === 0) {
      return;
    }
    fitViewOnLayoutRef.current = false;
    void fitView({ padding: 0.2, duration: 180 });
  }, [blockCount, fitView]);

  const dispatch = useCallback((command: QABlockCommand) => {
    const result = applyQABlockCommand(documentRef.current, command);
    documentRef.current = result.document;
    setDocument(result.document);
    if (result.meta.statusMessage) {
      setStatus(result.meta.statusMessage);
    }
    return result;
  }, []);

  const runBlock = useCallback(
    async (blockId: string) => {
      setRunningBlockId(blockId);
      setStatus("Running agent...");
      dispatch({ type: "set_block_answer", blockId, text: "" });
      try {
        let streamed = "";
        await streamBlock(documentRef.current, blockId, (delta) => {
          streamed += delta;
          dispatch({ type: "set_block_answer", blockId, text: streamed });
        });
        setStatus("Answer complete.");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Error: ${message}`);
        dispatch({ type: "set_block_answer", blockId, text: message });
      } finally {
        setRunningBlockId(null);
      }
    },
    [dispatch],
  );

  const composerAnchor = useCallback(() => {
    const pane = globalThis.document.querySelector(".react-flow");
    if (!pane) {
      return { x: 0, y: 0 };
    }
    const rect = pane.getBoundingClientRect();
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom - 88,
    });
  }, [screenToFlowPosition]);

  const onComposerSubmit = useCallback(
    (question: string) => {
      const result = dispatch({
        type: "create_block_from_composer",
        question,
        selectedBlockId,
        anchor: composerAnchor(),
      });
      if (!result.meta.blockId) {
        return;
      }
      setSelectedBlockId(result.meta.blockId);
      setExpandedBlockId(result.meta.blockId);
      setDeleteArmedBlockId(null);
      fitViewOnLayoutRef.current = true;
      void runBlock(result.meta.blockId);
    },
    [composerAnchor, dispatch, runBlock, selectedBlockId],
  );

  const onQuestionChange = useCallback(
    (blockId: string, question: string) => {
      dispatch({ type: "update_block_question", blockId, question });
    },
    [dispatch],
  );

  const onSelect = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
    setDeleteArmedBlockId(null);
  }, []);

  const onToggleExpand = useCallback((blockId: string) => {
    setExpandedBlockId((current) => (current === blockId ? null : blockId));
  }, []);

  const onAnswerAction = useCallback(
    (blockId: string, action: AnswerAction) => {
      const source = documentRef.current.blocks.find((block) => block.id === blockId);
      if (!source || source.answer.trim().length === 0 || runningBlockId !== null) {
        setStatus("Answer action is unavailable while the answer is empty or running.");
        return;
      }
      const result = dispatch({
        type: "create_block_from_action",
        action,
        selectedBlockId: blockId,
      });
      if (!result.meta.blockId) {
        return;
      }
      setSelectedBlockId(result.meta.blockId);
      setExpandedBlockId(result.meta.blockId);
      fitViewOnLayoutRef.current = true;
      void runBlock(result.meta.blockId);
    },
    [dispatch, runBlock, runningBlockId],
  );

  const onArmDelete = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
    setDeleteArmedBlockId(blockId);
  }, []);

  const deleteBlock = useCallback(
    (blockId: string) => {
      dispatch({ type: "delete_block", blockId });
      setDeleteArmedBlockId(null);
      setSelectedBlockId((current) => (current === blockId ? null : current));
      setExpandedBlockId((current) => (current === blockId ? null : current));
    },
    [dispatch],
  );

  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (event.detail !== 2) {
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const result = dispatch({ type: "create_block_at", position });
      if (result.meta.blockId) {
        setSelectedBlockId(result.meta.blockId);
        setExpandedBlockId(result.meta.blockId);
        fitViewOnLayoutRef.current = true;
      }
    },
    [dispatch, screenToFlowPosition],
  );

  const updateDraggedBlockPosition = useCallback(
    (node: QABlockFlowNode) => {
      dispatch({
        type: "move_block",
        blockId: node.id,
        position: roundedPosition(node.position),
      });
    },
    [dispatch],
  );

  const isTextEntryTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return Boolean(target.closest("textarea, input, button, [contenteditable]:not([contenteditable='false'])"));
  }, []);

  const handleAppKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isTextEntryTarget(event.target)) {
        return;
      }
      if (event.key === "Escape") {
        setDeleteArmedBlockId(null);
        return;
      }
      if (event.key === "Delete" && selectedBlockId) {
        event.preventDefault();
        if (deleteArmedBlockId === selectedBlockId) {
          deleteBlock(selectedBlockId);
        } else {
          setDeleteArmedBlockId(selectedBlockId);
        }
      }
    },
    [deleteArmedBlockId, deleteBlock, isTextEntryTarget, selectedBlockId],
  );

  const flowNodes = useMemo(
    () =>
      toQABlockFlowNodes({
        document,
        runningBlockId,
        selectedBlockId,
        expandedBlockId,
        deleteArmedBlockId,
        callbacks: {
          onQuestionChange,
          onSelect,
          onToggleExpand,
          onAnswerAction,
          onArmDelete,
          onDelete: deleteBlock,
        },
      }),
    [
      deleteArmedBlockId,
      deleteBlock,
      document,
      expandedBlockId,
      onAnswerAction,
      onArmDelete,
      onQuestionChange,
      onSelect,
      onToggleExpand,
      runningBlockId,
      selectedBlockId,
    ],
  );

  const flowEdges = useMemo(() => toQABlockFlowEdges(document), [document]);

  const compiledPreview = useMemo(() => {
    if (!selectedBlockId) {
      return null;
    }
    try {
      return compileQABlockContext(document, selectedBlockId);
    } catch {
      return null;
    }
  }, [document, selectedBlockId]);

  const selectedBlock = useMemo(
    () => document.blocks.find((block) => block.id === selectedBlockId),
    [document.blocks, selectedBlockId],
  );

  return (
    <div
      className="app-shell app-shell-v2"
      data-testid="app-shell"
      tabIndex={0}
      onKeyDown={handleAppKeyDown}
    >
      <div className="canvas-panel">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={canvasNodeTypes}
          deleteKeyCode={null}
          panOnScroll={false}
          zoomOnScroll
          zoomOnDoubleClick={false}
          panOnDrag={[1]}
          onNodeClick={(_, node) => onSelect(node.id)}
          onNodeDoubleClick={(event, node) => {
            event.stopPropagation();
            onArmDelete(node.id);
          }}
          onNodeDragStop={(_, node) => updateDraggedBlockPosition(node as QABlockFlowNode)}
          onPaneClick={(event) => {
            if (event.detail === 1) {
              setSelectedBlockId(null);
              setDeleteArmedBlockId(null);
            }
            onPaneClick(event);
          }}
        >
          <Background gap={22} color="#dccab8" />
          <MiniMap
            maskColor="rgba(245, 234, 220, 0.64)"
            nodeColor={() => "#f6d8c8"}
            pannable
            zoomable
          />
          <Controls />
        </ReactFlow>
        <BottomComposer disabled={runningBlockId !== null} onSubmit={onComposerSubmit} />
        <div className="v2-status-bar" aria-live="polite">
          <span>{status}</span>
          {selectedBlock ? (
            <span className="v2-status-selection">
              {selectedBlock.question.slice(0, 48) || selectedBlock.id}
            </span>
          ) : null}
        </div>
      </div>
      {compiledPreview ? (
        <aside className="v2-context-preview" aria-label="Compiled context preview">
          <h2>Context</h2>
          <pre>{compiledPreview.contextText || "No lineage context yet."}</pre>
        </aside>
      ) : null}
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <QABlockCanvasApp />
    </ReactFlowProvider>
  );
}
