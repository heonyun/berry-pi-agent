import { memo, useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import type { StanceBand } from "../shared/domain.ts";
import type { AnswerAction } from "../adapters/react-flow.ts";
import { ImeTextarea, stopNodeKeyPropagation } from "./ImeTextarea.tsx";

export interface QABlockNodeData {
  blockId: string;
  question: string;
  answer: string;
  stance: StanceBand;
  expanded: boolean;
  running: boolean;
  selected?: boolean;
  deleteArmed?: boolean;
  onQuestionChange?: (blockId: string, question: string) => void;
  onSelect?: (blockId: string) => void;
  onToggleExpand?: (blockId: string) => void;
  onAnswerAction?: (blockId: string, action: AnswerAction) => void;
  onArmDelete?: (blockId: string) => void;
  onDelete?: (blockId: string) => void;
  [key: string]: unknown;
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

function stanceClass(stance: StanceBand): string {
  return `stance-${stance}`;
}

function shouldIgnoreNodeGesture(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      ".nodrag, .answer-action-corner, .delete-node-button, .node-drag-handle, textarea, button",
    ),
  );
}

export const QABlockNode = memo(function QABlockNode({
  data,
  dragging,
  selected,
}: NodeProps<Node<QABlockNodeData>>) {
  const latestQuestionRef = useRef(data.question);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    latestQuestionRef.current = data.question;
  }, [data.question]);

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
        data.onArmDelete?.(data.blockId);
      }, 600);
    },
    [clearTimer, data],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const handleToggle = useCallback(
    (event: MouseEvent) => {
      if (shouldIgnoreNodeGesture(event.target)) {
        return;
      }
      data.onSelect?.(data.blockId);
      data.onToggleExpand?.(data.blockId);
    },
    [data],
  );

  const handleQuestionCommit = useCallback(
    (value: string) => {
      latestQuestionRef.current = value;
      data.onQuestionChange?.(data.blockId, value);
    },
    [data],
  );

  const actionDisabled =
    data.running || data.answer.trim().length === 0 || !data.selected || !selected;

  return (
    <div
      className={[
        "qa-block-node",
        data.expanded ? "qa-block-node-expanded" : "qa-block-node-compact",
        selected || data.selected ? "qa-block-selected" : "",
        dragging ? "qa-block-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleToggle}
      onPointerDown={handlePointerDown}
      onPointerMove={clearTimer}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
    >
      {ANSWER_ACTIONS.map((item) => (
        <button
          key={item.action}
          type="button"
          className={`${item.className} nodrag nopan`}
          aria-label={item.label}
          title={item.title}
          disabled={actionDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => {
            event.stopPropagation();
            if (!actionDisabled) {
              data.onAnswerAction?.(data.blockId, item.action);
            }
          }}
          onKeyDown={stopNodeKeyPropagation}
        />
      ))}
      {data.deleteArmed ? (
        <button
          type="button"
          className="delete-node-button qa-block-delete nodrag nopan"
          aria-label="Delete block"
          title="Delete block"
          onClick={(event) => {
            event.stopPropagation();
            data.onDelete?.(data.blockId);
          }}
          onKeyDown={stopNodeKeyPropagation}
        >
          ×
        </button>
      ) : null}
      <header className="qa-block-header node-drag-handle">
        <span>Q&A Block</span>
        <span className={stanceClass(data.stance)}>{data.stance}</span>
      </header>
      {data.expanded ? (
        <ImeTextarea
          className="qa-block-question-input nodrag nopan nowheel"
          value={data.question}
          disabled={data.running}
          placeholder="Question…"
          onLocalChange={(value) => {
            latestQuestionRef.current = value;
          }}
          onValueChange={handleQuestionCommit}
          onKeyDown={stopNodeKeyPropagation}
          onKeyUp={stopNodeKeyPropagation}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <div className="qa-block-question">{data.question || "Question…"}</div>
      )}
      {data.expanded ? (
        <div className="qa-block-answer">
          {data.answer || (data.running ? <span className="streaming-dot" aria-label="Streaming answer" /> : "Answer pending.")}
        </div>
      ) : data.answer.trim() ? (
        <div className="qa-block-answer-preview">{data.answer}</div>
      ) : null}
    </div>
  );
});
