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
import type { QABlockCommand } from "../core/qa-block-commands.ts";
import { applyQABlockCommand } from "../core/qa-block-reducer.ts";
import { columnBlocksSorted, blockDetached, reflowMagneticStacks } from "../core/magnetic-layout.ts";
import { roundedPosition } from "../core/mutations.ts";
import { compileQABlockContext } from "../shared/compile-qablock-context.ts";
import { createEmptyQABlockDocument, QA_BLOCK_APPROX_HEIGHT } from "../shared/domain.ts";
import { BottomComposer, type BottomComposerHandle } from "./BottomComposer.tsx";
import { canvasNodeTypes } from "./canvas-nodes.tsx";
import { streamBlock } from "./stream-block.ts";
import { formatStreamError } from "./format-stream-error.ts";
import { MatrixCanvas } from "./MatrixCanvas.tsx";

const KEYBOARD_HINT = "Alt+↑ new block · Alt+↓ composer · Alt+←/→ navigate";

function QABlockCanvasApp() {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [document, setDocument] = useState(() => createEmptyQABlockDocument());
  const documentRef = useRef(document);
  const fitViewOnLayoutRef = useRef(false);
  const blockHeightsRef = useRef<Map<string, number>>(new Map());
  const composerRef = useRef<BottomComposerHandle>(null);
  const pendingComposerFocusRef = useRef(false);
  const [blockHeightsVersion, setBlockHeightsVersion] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [deleteArmedBlockId, setDeleteArmedBlockId] = useState<string | null>(null);
  const [runningBlockId, setRunningBlockId] = useState<string | null>(null);
  const [blockErrors, setBlockErrors] = useState<ReadonlyMap<string, string>>(() => new Map());
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

  const applyStackReflow = useCallback(() => {
    const blocks = documentRef.current.blocks;
    if (blocks.length < 2) {
      return;
    }
    const heights = new Map(blockHeightsRef.current);
    for (const block of blocks) {
      if (!heights.has(block.id)) {
        heights.set(block.id, QA_BLOCK_APPROX_HEIGHT);
      }
    }
    const positions = reflowMagneticStacks(blocks, heights);
    for (const [blockId, position] of positions) {
      const block = documentRef.current.blocks.find((candidate) => candidate.id === blockId);
      if (!block) {
        continue;
      }
      if (block.position.x === position.x && block.position.y === position.y) {
        continue;
      }
      dispatch({ type: "move_block", blockId, position, syncSnapPosition: true });
    }
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;
    let outerFrame = 0;
    let innerFrame = 0;
    outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        if (!cancelled) {
          applyStackReflow();
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [applyStackReflow, document.blocks, expandedBlockId, blockHeightsVersion]);

  useEffect(() => {
    if (runningBlockId !== null || !pendingComposerFocusRef.current) {
      return;
    }
    pendingComposerFocusRef.current = false;
    const frame = requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [runningBlockId]);

  const runBlock = useCallback(
    async (blockId: string) => {
      setRunningBlockId(blockId);
      setStatus("Running agent...");
      setBlockErrors((current) => {
        if (!current.has(blockId)) {
          return current;
        }
        const next = new Map(current);
        next.delete(blockId);
        return next;
      });
      dispatch({ type: "set_block_answer", blockId, text: "" });
      try {
        let streamed = "";
        await streamBlock(documentRef.current, blockId, (delta) => {
          streamed += delta;
          dispatch({ type: "set_block_answer", blockId, text: streamed });
        });
        setStatus("Answer complete.");
      } catch (error: unknown) {
        const raw = error instanceof Error ? error.message : String(error);
        const message = formatStreamError(raw);
        setStatus(`Error: ${message}`);
        setBlockErrors((current) => new Map(current).set(blockId, message));
      } finally {
        pendingComposerFocusRef.current = true;
        setRunningBlockId(null);
        applyStackReflow();
        requestAnimationFrame(() => {
          applyStackReflow();
        });
      }
    },
    [applyStackReflow, dispatch],
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

  const createFromComposerPlacement = useCallback(
    (question: string) => {
      const result = dispatch({
        type: "create_block_from_composer",
        question,
        selectedBlockId,
        anchor: composerAnchor(),
      });
      if (!result.meta.blockId) {
        return null;
      }
      setSelectedBlockId(result.meta.blockId);
      setExpandedBlockId(result.meta.blockId);
      setDeleteArmedBlockId(null);
      fitViewOnLayoutRef.current = true;
      return result.meta.blockId;
    },
    [composerAnchor, dispatch, selectedBlockId],
  );

  const onComposerSubmit = useCallback(
    (question: string) => {
      const blockId = createFromComposerPlacement(question);
      if (!blockId) {
        return;
      }
      void runBlock(blockId);
    },
    [createFromComposerPlacement, runBlock],
  );

  const onQuestionChange = useCallback(
    (blockId: string, question: string) => {
      dispatch({ type: "update_block_question", blockId, question });
    },
    [dispatch],
  );

  const onSelect = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
    setExpandedBlockId(blockId);
    setDeleteArmedBlockId(null);
  }, []);

  const handleNodeClick = useCallback(
    (blockId: string) => {
      if (selectedBlockId === blockId) {
        setExpandedBlockId((current) => (current === blockId ? null : blockId));
        return;
      }
      onSelect(blockId);
    },
    [onSelect, selectedBlockId],
  );

  const onHeightChange = useCallback((blockId: string, height: number) => {
    const previous = blockHeightsRef.current.get(blockId);
    if (previous === height) {
      return;
    }
    blockHeightsRef.current.set(blockId, height);
    setBlockHeightsVersion((current) => current + 1);
  }, []);

  const onArmDelete = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
    setExpandedBlockId(blockId);
    setDeleteArmedBlockId(blockId);
  }, []);

  const deleteBlock = useCallback(
    (blockId: string) => {
      dispatch({ type: "delete_block", blockId });
      setDeleteArmedBlockId(null);
      setSelectedBlockId((current) => (current === blockId ? null : current));
      setExpandedBlockId((current) => (current === blockId ? null : current));
      blockHeightsRef.current.delete(blockId);
    },
    [dispatch],
  );

  const focusComposer = useCallback(() => {
    const textarea = globalThis.document.querySelector<HTMLTextAreaElement>(
      ".bottom-composer-input",
    );
    textarea?.focus();
    setStatus("Composer focused.");
  }, []);

  const navigateColumnBlock = useCallback(
    (direction: "previous" | "next") => {
      const ordered = columnBlocksSorted(documentRef.current.blocks, selectedBlockId);
      if (ordered.length === 0) {
        return;
      }
      const currentIndex = selectedBlockId
        ? ordered.findIndex((block) => block.id === selectedBlockId)
        : -1;
      const delta = direction === "previous" ? -1 : 1;
      const nextIndex =
        currentIndex === -1
          ? direction === "next"
            ? 0
            : ordered.length - 1
          : Math.min(Math.max(currentIndex + delta, 0), ordered.length - 1);
      const nextBlock = ordered[nextIndex];
      if (!nextBlock) {
        return;
      }
      onSelect(nextBlock.id);
      setStatus(`Selected block ${nextIndex + 1} of ${ordered.length}.`);
    },
    [onSelect, selectedBlockId],
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
        setDeleteArmedBlockId(null);
        fitViewOnLayoutRef.current = true;
      }
    },
    [dispatch, screenToFlowPosition],
  );

  const updateDraggedBlockPosition = useCallback(
    (node: QABlockFlowNode) => {
      const rounded = roundedPosition(node.position);
      const block = documentRef.current.blocks.find((candidate) => candidate.id === node.id);
      if (!block) {
        return;
      }
      if (!blockDetached(rounded, block.snapPosition)) {
        if (rounded.x !== block.snapPosition.x || rounded.y !== block.snapPosition.y) {
          dispatch({
            type: "move_block",
            blockId: node.id,
            position: block.snapPosition,
          });
          return;
        }
      }
      dispatch({
        type: "move_block",
        blockId: node.id,
        position: rounded,
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
      if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        focusComposer();
        return;
      }
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        createFromComposerPlacement("");
        setStatus("New block placed (composer placement rules).");
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        navigateColumnBlock("previous");
        return;
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        navigateColumnBlock("next");
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
    [
      createFromComposerPlacement,
      deleteArmedBlockId,
      deleteBlock,
      focusComposer,
      isTextEntryTarget,
      navigateColumnBlock,
      selectedBlockId,
    ],
  );

  const flowNodes = useMemo(
    () =>
      toQABlockFlowNodes({
        document,
        runningBlockId,
        selectedBlockId,
        expandedBlockId,
        deleteArmedBlockId,
        blockErrors,
        callbacks: {
          onQuestionChange,
          onSelect,
          onHeightChange,
          onArmDelete,
          onDelete: deleteBlock,
        },
      }),
    [
      blockErrors,
      deleteArmedBlockId,
      deleteBlock,
      document,
      expandedBlockId,
      onArmDelete,
      onHeightChange,
      onQuestionChange,
      onSelect,
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
          onNodeClick={(_, node) => handleNodeClick(node.id)}
          onNodeDoubleClick={(event, node) => {
            event.stopPropagation();
            onArmDelete(node.id);
          }}
          onNodeDragStop={(_, node) => updateDraggedBlockPosition(node as QABlockFlowNode)}
          onPaneClick={(event) => {
            if (event.detail === 1) {
              setSelectedBlockId(null);
              setExpandedBlockId(null);
              setDeleteArmedBlockId(null);
            }
            onPaneClick(event);
          }}
        >
          <Background gap={22} color="#dccab8" />
          <Controls position="top-right" showInteractive={false} />
        </ReactFlow>
        <BottomComposer ref={composerRef} disabled={runningBlockId !== null} onSubmit={onComposerSubmit} />
        <div className="v2-status-bar" aria-live="polite">
          <span>{status}</span>
          <span className="v2-status-hint">{KEYBOARD_HINT}</span>
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

function ViewToggle({ view, onToggle }: { view: "canvas" | "matrix"; onToggle: () => void }) {
  return (
    <button
      className="view-toggle-button"
      onClick={onToggle}
      title={view === "canvas" ? "Switch to Matrix view" : "Switch to Canvas view"}
    >
      {view === "canvas" ? "Matrix" : "Canvas"}
    </button>
  );
}

export function App() {
  const [view, setView] = useState<"canvas" | "matrix">("matrix");

  return (
    <>
      <ViewToggle view={view} onToggle={() => setView((v) => (v === "canvas" ? "matrix" : "canvas"))} />
      {view === "canvas" ? (
        <ReactFlowProvider>
          <QABlockCanvasApp />
        </ReactFlowProvider>
      ) : (
        <MatrixCanvas />
      )}
    </>
  );
}
