import { memo, useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { INITIAL_PROMPT_TEXT } from "../shared/domain.ts";
import type { StanceBand } from "../shared/domain.ts";
import type { AnswerAction, AnswerNodeData, PromptNodeData } from "../adapters/react-flow.ts";
import { ImeTextarea, stopNodeKeyPropagation } from "./ImeTextarea.tsx";

function stanceClass(stance: StanceBand): string {
  return `stance-${stance}`;
}

function shouldIgnoreNodeGesture(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      ".nodrag, .branch-dot, .react-flow__handle, .delete-node-button, .node-drag-handle",
    ),
  );
}

function BranchDots() {
  return (
    <>
      <Handle
        className="branch-dot branch-dot-top nodrag nopan"
        id="branch-top"
        type="source"
        position={Position.Top}
      />
      <Handle
        className="branch-dot branch-dot-right nodrag nopan"
        id="branch-right"
        type="source"
        position={Position.Right}
      />
      <Handle
        className="branch-dot branch-dot-bottom nodrag nopan"
        id="branch-bottom"
        type="source"
        position={Position.Bottom}
      />
      <Handle
        className="branch-dot branch-dot-left nodrag nopan"
        id="branch-left"
        type="source"
        position={Position.Left}
      />
    </>
  );
}

function DeleteButton({
  nodeId,
  visible,
  onDelete,
}: {
  nodeId: string;
  visible: boolean;
  onDelete: (nodeId: string) => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      className="delete-node-button nodrag nopan"
      aria-label="Delete node"
      title="Delete node"
      onClick={(event) => {
        event.stopPropagation();
        onDelete(nodeId);
      }}
      onKeyDown={stopNodeKeyPropagation}
    >
      ×
    </button>
  );
}

const ANSWER_ACTIONS: Array<{
  action: AnswerAction;
  className: string;
  label: string;
  title: string;
}> = [
  {
    action: "risks",
    className: "answer-action-corner top-left",
    label: "Ask for answer risks",
    title: "Risks",
  },
  {
    action: "positives",
    className: "answer-action-corner top-right",
    label: "Ask for answer positives",
    title: "Positives",
  },
  {
    action: "risk_retry",
    className: "answer-action-corner bottom-left",
    label: "Ask to rethink answer risks",
    title: "Rethink risks",
  },
];

function useLongPressDeleteArm(nodeId: string, onArmDelete: (nodeId: string) => void) {
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (shouldIgnoreNodeGesture(event.target)) {
        return;
      }
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        onArmDelete(nodeId);
      }, 600);
    },
    [clearTimer, nodeId, onArmDelete],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { handlePointerDown, clearTimer };
}

export const PromptInputNode = memo(function PromptInputNode({
  data,
  dragging,
  selected,
}: NodeProps<Node<PromptNodeData>>) {
  const {
    nodeId,
    text,
    stance,
    running,
    interactionDisabled,
    deleteArmed,
    onDraftChange,
    onTextChange,
    onRun,
    onArmDelete,
    onDelete,
  } = data;
  const latestTextRef = useRef(text);
  const { handlePointerDown, clearTimer } = useLongPressDeleteArm(nodeId, onArmDelete);

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

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      stopNodeKeyPropagation(event);
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
        event.preventDefault();
        handleRun();
      }
    },
    [handleRun],
  );

  return (
    <div className={`node-card prompt ${dragging ? "dragging" : ""} ${selected ? "selected" : ""} ${data.isNew ? "is-new" : ""}`}>
      <Handle type="target" position={Position.Bottom} />
      <BranchDots />
      <DeleteButton nodeId={nodeId} visible={deleteArmed} onDelete={onDelete} />
      <header className="node-drag-handle">
        <span>Prompt</span>
        <span className={stanceClass(stance)}>{stance}</span>
      </header>
      <div
        className="node-body"
        onPointerDown={handlePointerDown}
        onPointerMove={clearTimer}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onPointerLeave={clearTimer}
      >
      <ImeTextarea
        className="nodrag nopan nowheel"
        data-prompt-id={nodeId}
        value={text}
        disabled={interactionDisabled}
        clearOnFocusValue={INITIAL_PROMPT_TEXT}
        onLocalChange={handleLocalChange}
        onValueChange={handleCommit}
        onKeyDown={handleTextareaKeyDown}
        onKeyUp={stopNodeKeyPropagation}
        placeholder="Ask the agent..."
      />
      <div className="node-actions nodrag nopan">
        <button
          className="primary nodrag nopan"
          type="button"
          disabled={running || interactionDisabled}
          onKeyDown={stopNodeKeyPropagation}
          onClick={handleRun}
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>
      </div>
    </div>
  );
});

export const AIAnswerNode = memo(function AIAnswerNode({
  data,
  dragging,
  selected,
}: NodeProps<Node<AnswerNodeData>>) {
  const { handlePointerDown, clearTimer } = useLongPressDeleteArm(data.nodeId, data.onArmDelete);
  const actionDisabled =
    data.interactionDisabled ||
    data.running ||
    data.text.trim().length === 0 ||
    !data.selected ||
    data.multiSelected;
  return (
    <div className={`node-card answer ${dragging ? "dragging" : ""} ${selected ? "selected" : ""} ${data.isNew ? "is-new" : ""}`}>
      <Handle type="target" position={Position.Bottom} />
      <BranchDots />
      {ANSWER_ACTIONS.map((item) => (
        <button
          key={item.action}
          type="button"
          className={`${item.className} nodrag nopan`}
          aria-label={item.label}
          title={item.title}
          disabled={actionDisabled}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            if (!actionDisabled) {
              data.onAnswerAction(data.nodeId, item.action);
            }
          }}
          onKeyDown={stopNodeKeyPropagation}
        />
      ))}
      <DeleteButton nodeId={data.nodeId} visible={data.deleteArmed} onDelete={data.onDelete} />
      <header className="node-drag-handle">
        <span>AI Answer</span>
        <span className={stanceClass(data.stance)}>{data.stance}</span>
      </header>
      <div
        className="node-body"
        onPointerDown={handlePointerDown}
        onPointerMove={clearTimer}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onPointerLeave={clearTimer}
      >
      <div className="answer-text">
        {data.text || (data.running ? <span className="streaming-dot" aria-label="Streaming answer" /> : "No answer yet.")}
      </div>
      <div className="feedback-row nodrag nopan">
        {(["agree", "disagree", "unsure"] as const).map((feedback) => (
          <button
            key={feedback}
            type="button"
            className={`nodrag nopan ${data.feedback === feedback ? "active" : ""}`}
            disabled={data.interactionDisabled}
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
          disabled={data.running || data.interactionDisabled}
          onKeyDown={stopNodeKeyPropagation}
          onClick={() => data.onRetry(data.nodeId)}
        >
          Regenerate answer (v{data.versionCount + 1})
        </button>
      </div>
      </div>
    </div>
  );
});

export const canvasNodeTypes = {
  promptInput: PromptInputNode,
  aiAnswer: AIAnswerNode,
};
