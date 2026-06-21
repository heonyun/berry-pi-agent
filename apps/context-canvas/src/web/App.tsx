import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type FinalConnectionState,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  connectionToContextReferenceCommand,
  toReactFlowEdges,
  toReactFlowNodes,
  type AnswerAction,
  type CanvasFlowNode,
} from "../adapters/react-flow.ts";
import type { ApplyResult, CanvasCommand } from "../core/commands.ts";
import { findLineageParentPromptId, roundedPosition } from "../core/mutations.ts";
import { applyCommand } from "../core/reducer.ts";
import { compilePromptContext } from "../shared/compiler.ts";
import { buildNodeBacklinks, formatCompiledPreviewMarkdown } from "../shared/compile-preview.ts";
import { createInitialDocument, type ContextNode, type Vec2 } from "../shared/domain.ts";
import { canvasNodeTypes } from "./canvas-nodes.tsx";
import { exportBundle } from "./export-bundle.ts";
import { loadBundle } from "./load-bundle.ts";
import { streamPrompt } from "./stream-prompt.ts";

function CanvasApp() {
  const ANSWER_SHORTCUT_SEQUENCE_MS = 400;
  const APPROX_NODE_WIDTH = 320;
  const APPROX_NODE_HEIGHT = 180;
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [document, setDocument] = useState(() => createInitialDocument());
  const documentRef = useRef(document);
  const promptDraftsRef = useRef(new Map<string, string>());
  const fitViewOnLayoutRef = useRef(true);
  const nextPromptTimeoutRef = useRef<number | null>(null);
  const groupSummarySaveTimeoutRef = useRef<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("prompt-1");
  const [selectedNodeIds, setSelectedNodeIds] = useState<ReadonlySet<string>>(() => new Set(["prompt-1"]));
  const [deleteArmedNodeId, setDeleteArmedNodeId] = useState<string | null>(null);
  const [newNodeIds, setNewNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const [groupConfirm, setGroupConfirm] = useState<{
    nodeIds: string[];
    screenPosition: { x: number; y: number };
  } | null>(null);
  const [status, setStatus] = useState<string>("Loading saved bundle...");
  const bundleLoadCompleteRef = useRef(false);
  const bundleLoadFailureRef = useRef<string | null>(null);
  const pressedArrowsRef = useRef(new Set<string>());
  const pendingShortcutRef = useRef<{ key: "ArrowLeft" | "ArrowRight"; at: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const selectionBoxRef = useRef<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const dragJustCompletedRef = useRef(false);
  const userInteractionVersionRef = useRef(0);
  const nodeCount = document.nodes.length;
  const edgeCount = document.edges.length;
  const interactionDisabled = !bundleLoadCompleteRef.current || bundleLoadFailureRef.current !== null;

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    let cancelled = false;
    void loadBundle()
      .then((result) => {
        if (cancelled) {
          return;
        }
        bundleLoadCompleteRef.current = true;
        bundleLoadFailureRef.current = null;
        if (!result.document) {
          setStatus(result.errors.length > 0 ? result.errors.join(" ") : "Ready");
          return;
        }
        documentRef.current = result.document;
        setDocument(result.document);
        const firstPrompt = result.document.nodes.find((node) => node.kind === "prompt_input");
        const nextSelectedId = firstPrompt?.id ?? result.document.nodes[0]?.id ?? "";
        setSelectedNodeId(nextSelectedId);
        setSelectedNodeIds(nextSelectedId ? new Set([nextSelectedId]) : new Set());
        fitViewOnLayoutRef.current = true;
        const warningCount = result.warnings.length;
        setStatus(warningCount > 0 ? `Saved bundle loaded (${warningCount} warnings).` : "Saved bundle loaded.");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        const statusMessage = `Bundle load failed: ${message}`;
        bundleLoadFailureRef.current = statusMessage;
        setStatus(statusMessage);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (nextPromptTimeoutRef.current !== null) {
        window.clearTimeout(nextPromptTimeoutRef.current);
      }
      if (groupSummarySaveTimeoutRef.current !== null) {
        window.clearTimeout(groupSummarySaveTimeoutRef.current);
      }
    };
  }, []);

  const resetAnswerShortcutState = useCallback(() => {
    pressedArrowsRef.current.clear();
    pendingShortcutRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("blur", resetAnswerShortcutState);
    return () => {
      window.removeEventListener("blur", resetAnswerShortcutState);
    };
  }, [resetAnswerShortcutState]);

  useEffect(() => {
    if (!fitViewOnLayoutRef.current) {
      return;
    }
    fitViewOnLayoutRef.current = false;
    void fitView({ padding: 0.2, duration: 180 });
  }, [edgeCount, fitView, nodeCount]);

  const markNodeAsNew = useCallback((nodeId: string) => {
    setNewNodeIds((current) => new Set([...current, nodeId]));
    window.setTimeout(() => {
      setNewNodeIds((current) => {
        if (!current.has(nodeId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(nodeId);
        return next;
      });
    }, 220);
  }, []);

  const blockUntilBundleReady = useCallback((): ApplyResult => {
    const message = bundleLoadFailureRef.current ?? "Waiting for saved bundle to load...";
    setStatus(message);
    return { document: documentRef.current, meta: { statusMessage: message } };
  }, []);

  const dispatch = useCallback((command: CanvasCommand) => {
    if (!bundleLoadCompleteRef.current || bundleLoadFailureRef.current) {
      return blockUntilBundleReady();
    }
    const result = applyCommand(documentRef.current, command);
    documentRef.current = result.document;
    setDocument(result.document);
    if (result.meta.createdAnswer) {
      fitViewOnLayoutRef.current = true;
    }
    if (result.meta.promptId) {
      setSelectedNodeId(result.meta.promptId);
      setSelectedNodeIds(new Set([result.meta.promptId]));
      setDeleteArmedNodeId(null);
      if (
        command.type === "create_prompt_at" ||
        command.type === "create_prompt_from_source" ||
        command.type === "ensure_next_prompt"
      ) {
        markNodeAsNew(result.meta.promptId);
      }
      if (command.type === "ensure_next_prompt") {
        fitViewOnLayoutRef.current = true;
      }
    }
    if (result.meta.createdAnswer && result.meta.answerId) {
      markNodeAsNew(result.meta.answerId);
    }
    if (result.meta.statusMessage) {
      setStatus(result.meta.statusMessage);
    }
    return result;
  }, [blockUntilBundleReady, markNodeAsNew]);

  const updatePromptDraft = useCallback((nodeId: string, text: string) => {
    if (!bundleLoadCompleteRef.current || bundleLoadFailureRef.current) {
      blockUntilBundleReady();
      return;
    }
    promptDraftsRef.current.set(nodeId, text);
  }, [blockUntilBundleReady]);

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
    if (bundleLoadFailureRef.current) {
      setStatus(bundleLoadFailureRef.current);
      return;
    }
    if (!bundleLoadCompleteRef.current) {
      setStatus("Waiting for saved bundle to load...");
      return;
    }
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
      if (bundleLoadFailureRef.current) {
        setStatus(bundleLoadFailureRef.current);
        return;
      }
      if (!bundleLoadCompleteRef.current) {
        setStatus("Waiting for saved bundle to load...");
        return;
      }
      setRunningPromptId(promptNodeId);
      setStatus("Running agent...");
      const focusVersion = userInteractionVersionRef.current;

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
        nextPromptTimeoutRef.current = window.setTimeout(() => {
          const result = dispatch({ type: "ensure_next_prompt", answerId: answerId! });
          if (result.meta.promptId && userInteractionVersionRef.current === focusVersion) {
            window.setTimeout(() => {
              const textarea = globalThis.document.querySelector<HTMLTextAreaElement>(
                `textarea[data-prompt-id="${result.meta.promptId}"]`,
              );
              textarea?.focus();
            }, 0);
          }
          void saveBundle();
        }, 3000);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Error: ${message}`);
        if (answerId) {
          setAnswerText(answerId, message);
        }
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

  const setSingleSelection = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds(new Set([nodeId]));
    setDeleteArmedNodeId(null);
    setGroupConfirm(null);
  }, []);

  const selectedAnswerForAction = useCallback((): ContextNode | undefined => {
    if (selectedNodeIds.size !== 1) {
      setStatus("Select exactly one answer node for this action.");
      return undefined;
    }
    const nodeId = [...selectedNodeIds][0]!;
    const node = documentRef.current.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      setStatus("Selected node is no longer available.");
      return undefined;
    }
    if (node.kind !== "ai_answer") {
      setStatus("Select an AI answer node for this action.");
      return undefined;
    }
    if (runningPromptId !== null || node.text.trim().length === 0) {
      setStatus("Answer action is unavailable while the answer is empty or running.");
      return undefined;
    }
    return node;
  }, [runningPromptId, selectedNodeIds]);

  const createAnswerFollowUp = useCallback(
    (answer: ContextNode, action: AnswerAction) => {
      if (answer.kind !== "ai_answer") {
        return;
      }
      const promptTextByAction: Record<AnswerAction, string> = {
        risks: "좋아. 너의 답에서 예상 문제와 위험을 말해.",
        positives: "좋아. 너의 답에서 예상 긍정을 말해.",
        risk_retry: "다시 너의 답에 문제와 위험을 생각해서 답해.",
      };
      const positionByAction: Record<AnswerAction, Vec2> = {
        risks: { x: answer.position.x - 360, y: answer.position.y - 220 },
        positives: { x: answer.position.x + 360, y: answer.position.y - 220 },
        risk_retry: { x: answer.position.x - 360, y: answer.position.y + 220 },
      };
      const created = dispatch({
        type: "create_prompt_from_source",
        sourceNodeId: answer.id,
        position: positionByAction[action],
      });
      if (!created.meta.promptId) {
        return;
      }
      dispatch({
        type: "connect_context_reference",
        source: answer.id,
        target: created.meta.promptId,
      });
      dispatch({
        type: "update_prompt_text",
        nodeId: created.meta.promptId,
        text: promptTextByAction[action],
      });
      promptDraftsRef.current.set(created.meta.promptId, promptTextByAction[action]);
      setStatus("Follow-up prompt created.");
      void saveBundle(created.meta.promptId);
    },
    [dispatch, saveBundle],
  );

  const onAnswerAction = useCallback(
    (nodeId: string, action: AnswerAction) => {
      if (selectedNodeIds.size !== 1 || !selectedNodeIds.has(nodeId)) {
        setStatus("Select exactly one answer node for this action.");
        return;
      }
      const answer = documentRef.current.nodes.find((candidate) => candidate.id === nodeId);
      if (!answer || answer.kind !== "ai_answer" || runningPromptId !== null || answer.text.trim().length === 0) {
        setStatus("Answer action is unavailable while the answer is empty or running.");
        return;
      }
      createAnswerFollowUp(answer, action);
    },
    [createAnswerFollowUp, runningPromptId, selectedNodeIds],
  );

  const retrySelectedAnswer = useCallback(() => {
    const answer = selectedAnswerForAction();
    if (!answer || answer.kind !== "ai_answer") {
      return;
    }
    onRetry(answer.id);
  }, [onRetry, selectedAnswerForAction]);

  const isTextEntryTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return Boolean(target.closest("textarea, input, button, [contenteditable]:not([contenteditable='false'])"));
  }, []);

  const deleteNode = useCallback(
    (nodeId: string) => {
      const result = dispatch({ type: "delete_node", nodeId });
      const remainingNodeIds = new Set(result.document.nodes.map((node) => node.id));
      const remainingSelected = [...selectedNodeIds].filter(
        (selectedId) => selectedId !== nodeId && remainingNodeIds.has(selectedId),
      );
      const currentStillSelected = selectedNodeId !== nodeId && remainingNodeIds.has(selectedNodeId);
      const nextSelectedId =
        currentStillSelected
          ? selectedNodeId
          : remainingSelected[0] ?? result.document.nodes.find((node) => node.id !== nodeId)?.id ?? "";
      setDeleteArmedNodeId(null);
      setSelectedNodeId(nextSelectedId);
      setSelectedNodeIds(
        nextSelectedId
          ? new Set(remainingSelected.includes(nextSelectedId) ? remainingSelected : [nextSelectedId])
          : new Set(),
      );
    },
    [dispatch, selectedNodeId, selectedNodeIds],
  );

  const handleAppKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isTextEntryTarget(event.target)) {
        return;
      }
      if (event.key === "Escape") {
        setGroupConfirm(null);
        setSelectionBox(null);
        selectionStartRef.current = null;
        selectionBoxRef.current = null;
        resetAnswerShortcutState();
        return;
      }
      if (event.repeat) {
        return;
      }
      if (event.key === "Delete" && selectedNodeIds.size === 1) {
        const selectedId = selectedNodeIds.values().next().value;
        if (selectedId) {
          event.preventDefault();
          event.stopPropagation();
          // INVARIANT: first Delete arms; second Delete on same armed selection deletes (keyboard-only path).
          // RELATED: App.test.tsx — "deletes the armed node when Delete is pressed a second time"
          if (deleteArmedNodeId === selectedId) {
            deleteNode(selectedId);
          } else {
            setDeleteArmedNodeId(selectedId);
          }
        }
        return;
      }
      if (event.key.startsWith("Arrow")) {
        pressedArrowsRef.current.add(event.key);
      }
      if (groupConfirm && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        dispatch({
          type: "create_group_from_nodes",
          nodeIds: groupConfirm.nodeIds,
          origin: screenToFlowPosition(groupConfirm.screenPosition),
        });
        setGroupConfirm(null);
        return;
      }
      if (!event.ctrlKey || !event.key.startsWith("Arrow")) {
        if (!event.key.startsWith("Arrow")) {
          resetAnswerShortcutState();
        }
        return;
      }
      const now = performance.now();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        pendingShortcutRef.current = { key: event.key, at: now };
        return;
      }
      const pending = pendingShortcutRef.current;
      const pendingIsFresh = Boolean(pending && now - pending.at <= ANSWER_SHORTCUT_SEQUENCE_MS);
      const action =
        event.key === "ArrowUp" && pendingIsFresh && pending?.key === "ArrowLeft"
          ? "risks"
          : event.key === "ArrowUp" && pendingIsFresh && pending?.key === "ArrowRight"
            ? "positives"
            : event.key === "ArrowDown" && pendingIsFresh && pending?.key === "ArrowLeft"
              ? "risk_retry"
              : undefined;
      if (!action && event.key !== "ArrowDown") {
        resetAnswerShortcutState();
        return;
      }
      const answer = selectedAnswerForAction();
      if (!answer || answer.kind !== "ai_answer") {
        resetAnswerShortcutState();
        return;
      }
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        createAnswerFollowUp(answer, action);
        resetAnswerShortcutState();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        retrySelectedAnswer();
        resetAnswerShortcutState();
      }
    },
    [
      createAnswerFollowUp,
      dispatch,
      groupConfirm,
      isTextEntryTarget,
      resetAnswerShortcutState,
      retrySelectedAnswer,
      screenToFlowPosition,
      deleteArmedNodeId,
      deleteNode,
      selectedAnswerForAction,
      selectedNodeIds,
    ],
  );

  const handleAppKeyUp = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Control" || event.key === "Meta" || event.key.startsWith("Arrow")) {
      pressedArrowsRef.current.delete(event.key);
      pendingShortcutRef.current = null;
    }
  }, []);

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

  const armDelete = useCallback((nodeId: string) => {
    setSingleSelection(nodeId);
    setDeleteArmedNodeId(nodeId);
  }, [setSingleSelection]);

  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (event.detail !== 2) {
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      dispatch({ type: "create_prompt_at", position });
    },
    [dispatch, screenToFlowPosition],
  );

  const selectedNodesInRect = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const leftTop = screenToFlowPosition({
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
      });
      const rightBottom = screenToFlowPosition({
        x: Math.max(start.x, end.x),
        y: Math.max(start.y, end.y),
      });
      return documentRef.current.nodes
        .filter((node) => {
          const nodeLeft = node.position.x - APPROX_NODE_WIDTH / 2;
          const nodeRight = node.position.x + APPROX_NODE_WIDTH / 2;
          const nodeTop = node.position.y - APPROX_NODE_HEIGHT / 2;
          const nodeBottom = node.position.y + APPROX_NODE_HEIGHT / 2;
          return nodeRight >= leftTop.x && nodeLeft <= rightBottom.x && nodeBottom >= leftTop.y && nodeTop <= rightBottom.y;
        })
        .map((node) => node.id);
    },
    [screenToFlowPosition],
  );

  const clearSelectionDragState = useCallback(() => {
    selectionStartRef.current = null;
    selectionBoxRef.current = null;
    setSelectionBox(null);
  }, []);

  const pointerCoordinate = useCallback((event: ReactPointerEvent, axis: "x" | "y", fallback = 0) => {
    const nativeEvent = event.nativeEvent as PointerEvent & { x?: number; y?: number };
    const clientKey = axis === "x" ? "clientX" : "clientY";
    const pageKey = axis === "x" ? "pageX" : "pageY";
    const screenKey = axis === "x" ? "screenX" : "screenY";
    for (const value of [
      event[clientKey],
      nativeEvent[clientKey],
      nativeEvent[axis],
      nativeEvent[pageKey],
      nativeEvent[screenKey],
      fallback,
    ]) {
      if (Number.isFinite(value)) {
        return value;
      }
    }
    return fallback;
  }, []);

  const onPanePointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button > 0 || event.detail > 1) {
      return;
    }
    if (event.target instanceof HTMLElement && event.target.closest(".react-flow__node, textarea, input, button, [contenteditable]")) {
      return;
    }
    const pointerId = event.pointerId ?? 0;
    event.currentTarget.setPointerCapture?.(pointerId);
    selectionStartRef.current = {
      x: pointerCoordinate(event, "x"),
      y: pointerCoordinate(event, "y"),
      pointerId,
    };
    selectionBoxRef.current = null;
    setSelectionBox(null);
    setGroupConfirm(null);
  }, [pointerCoordinate]);

  const onPanePointerMove = useCallback((event: ReactPointerEvent) => {
    const start = selectionStartRef.current;
    const pointerId = event.pointerId ?? 0;
    if (!start || start.pointerId !== pointerId) {
      return;
    }
    const current = {
      x: pointerCoordinate(event, "x", start.x),
      y: pointerCoordinate(event, "y", start.y),
    };
    if (Math.abs(current.x - start.x) < 6 && Math.abs(current.y - start.y) < 6) {
      return;
    }
    const nextBox = { start, current };
    selectionBoxRef.current = nextBox;
    setSelectionBox(nextBox);
  }, [pointerCoordinate]);

  const onPanePointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const start = selectionStartRef.current;
      const pointerId = event.pointerId ?? 0;
      event.currentTarget.releasePointerCapture?.(pointerId);
      selectionStartRef.current = null;
      const box = selectionBoxRef.current;
      selectionBoxRef.current = null;
      setSelectionBox(null);
      if (!start || start.pointerId !== pointerId || !box) {
        return;
      }
      const releasePoint = {
        x: pointerCoordinate(event, "x", box.current.x),
        y: pointerCoordinate(event, "y", box.current.y),
      };
      const nodeIds = selectedNodesInRect(start, releasePoint);
      if (nodeIds.length === 0) {
        return;
      }
      dragJustCompletedRef.current = true;
      setSelectedNodeIds(new Set(nodeIds));
      setSelectedNodeId(nodeIds[0] ?? "");
      setGroupConfirm({ nodeIds, screenPosition: releasePoint });
    },
    [pointerCoordinate, selectedNodesInRect],
  );

  const onPanePointerCancel = useCallback((event: ReactPointerEvent) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId ?? 0);
    clearSelectionDragState();
  }, [clearSelectionDragState]);

  const confirmGroup = useCallback(() => {
    if (!groupConfirm) {
      return;
    }
    dispatch({
      type: "create_group_from_nodes",
      nodeIds: groupConfirm.nodeIds,
      origin: screenToFlowPosition(groupConfirm.screenPosition),
    });
    setGroupConfirm(null);
  }, [dispatch, groupConfirm, screenToFlowPosition]);

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

  const eventClientPoint = useCallback((event: MouseEvent | TouchEvent) => {
    if ("changedTouches" in event && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0]!;
      return { x: touch.clientX, y: touch.clientY };
    }
    const mouseEvent = event as MouseEvent;
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (!connectionState.fromNode || connectionState.toNode) {
        return;
      }
      const position = screenToFlowPosition(eventClientPoint(event));
      dispatch({
        type: "create_prompt_from_source",
        sourceNodeId: connectionState.fromNode.id,
        position,
        sourceHandle: connectionState.fromHandle?.id ?? undefined,
      });
    },
    [dispatch, eventClientPoint, screenToFlowPosition],
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
        interactionDisabled,
        callbacks: {
          onDraftChange: updatePromptDraft,
          onTextChange: updatePromptText,
          onRun: runPromptById,
          onArmDelete: armDelete,
          onDelete: deleteNode,
          onFeedback,
          onRetry,
          onAnswerAction,
        },
        deleteArmedNodeId,
        newNodeIds,
        selectedNodeIds,
      }),
    [
      armDelete,
      deleteArmedNodeId,
      deleteNode,
      document,
      interactionDisabled,
      newNodeIds,
      onAnswerAction,
      onFeedback,
      onRetry,
      runPromptById,
      runningPromptId,
      selectedNodeIds,
      updatePromptDraft,
      updatePromptText,
    ],
  );

  const flowEdges = useMemo(() => toReactFlowEdges(document), [document]);

  const selectedNode = useMemo(
    () => document.nodes.find((node) => node.id === selectedNodeId),
    [document, selectedNodeId],
  );

  const selectedGroup = useMemo(() => {
    if (!selectedNode || selectedNodeIds.size !== 1) {
      return undefined;
    }
    return document.groups.find((group) => group.id === selectedNode.groupId);
  }, [document.groups, selectedNode, selectedNodeIds.size]);

  const updateGroupSummary = useCallback(
    (groupId: string, summary: string) => {
      dispatch({ type: "update_group_summary", groupId, summary });
      if (groupSummarySaveTimeoutRef.current !== null) {
        window.clearTimeout(groupSummarySaveTimeoutRef.current);
      }
      groupSummarySaveTimeoutRef.current = window.setTimeout(() => {
        void saveBundle();
        groupSummarySaveTimeoutRef.current = null;
      }, 500);
    },
    [dispatch, saveBundle],
  );

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
    <div
      className="app-shell"
      data-testid="app-shell"
      tabIndex={0}
      onPointerDownCapture={() => {
        userInteractionVersionRef.current += 1;
      }}
      onKeyDownCapture={() => {
        userInteractionVersionRef.current += 1;
      }}
      onKeyDown={handleAppKeyDown}
      onKeyUp={handleAppKeyUp}
    >
      <div className="canvas-panel">
        {selectionBox ? <SelectionOverlay start={selectionBox.start} current={selectionBox.current} /> : null}
        {groupConfirm ? (
          <div
            className="group-confirm-toolbar"
            style={{ left: groupConfirm.screenPosition.x, top: groupConfirm.screenPosition.y }}
          >
            <button type="button" className="group-confirm-button" onClick={confirmGroup}>
              Create group
            </button>
            <button type="button" className="group-confirm-button group-confirm-cancel" onClick={() => setGroupConfirm(null)}>
              Cancel
            </button>
          </div>
        ) : null}
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={canvasNodeTypes}
          deleteKeyCode={null}
          panOnScroll={false}
          zoomOnScroll
          zoomOnDoubleClick={false}
          panOnDrag={[1]}
          onNodeClick={(_, node) => {
            setSingleSelection(node.id);
          }}
          onNodeDoubleClick={(event, node) => {
            event.stopPropagation();
            armDelete(node.id);
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            armDelete(node.id);
          }}
          onNodeDragStop={(_, node) => updateDraggedNodePosition(node as CanvasFlowNode)}
          onPaneClick={(event) => {
            if (dragJustCompletedRef.current) {
              dragJustCompletedRef.current = false;
              return;
            }
            setGroupConfirm(null);
            setDeleteArmedNodeId(null);
            setSelectedNodeId("");
            setSelectedNodeIds(new Set());
            onPaneClick(event);
          }}
          onPointerDown={onPanePointerDown}
          onPointerMove={onPanePointerMove}
          onPointerUp={onPanePointerUp}
          onPointerCancel={onPanePointerCancel}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
        >
          <Background gap={22} color="#dccab8" />
          <MiniMap
            maskColor="rgba(245, 234, 220, 0.64)"
            nodeColor={(node) => (node.type === "promptInput" ? "#f6d8c8" : "#dce7ce")}
            pannable
            zoomable
          />
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
          <h3>Group Summary</h3>
          {selectedGroup ? (
            <textarea
              className="group-summary-editor"
              value={selectedGroup.summary ?? ""}
              onChange={(event) => updateGroupSummary(selectedGroup.id, event.target.value)}
            />
          ) : (
            <p className="muted-line">Select a grouped node.</p>
          )}
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

function SelectionOverlay({
  start,
  current,
}: {
  start: { x: number; y: number };
  current: { x: number; y: number };
}) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return <div className="selection-overlay" style={{ left, top, width, height }} />;
}

export function App() {
  return (
    <ReactFlowProvider>
      <CanvasApp />
    </ReactFlowProvider>
  );
}
