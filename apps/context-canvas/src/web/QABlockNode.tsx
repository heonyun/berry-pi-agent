import { memo, useCallback, useEffect, useRef, type PointerEvent } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import type { StanceBand } from "../shared/domain.ts";
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
  errorMessage?: string;
  onQuestionChange?: (blockId: string, question: string) => void;
  onSelect?: (blockId: string) => void;
  onHeightChange?: (blockId: string, height: number) => void;
  onArmDelete?: (blockId: string) => void;
  onDelete?: (blockId: string) => void;
  [key: string]: unknown;
}

function stanceClass(stance: StanceBand): string {
  return `stance-${stance}`;
}

function shouldIgnoreNodeGesture(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(".nodrag, .delete-node-button, .node-drag-handle, textarea, button"),
  );
}

export const QABlockNode = memo(function QABlockNode({
  data,
  dragging,
  selected,
}: NodeProps<Node<QABlockNodeData>>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const latestQuestionRef = useRef(data.question);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    latestQuestionRef.current = data.question;
  }, [data.question]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || !data.onHeightChange) {
      return;
    }
    const report = () => data.onHeightChange?.(data.blockId, element.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data, data.answer, data.blockId, data.expanded, data.errorMessage, data.onHeightChange]);

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

  const handleQuestionCommit = useCallback(
    (value: string) => {
      latestQuestionRef.current = value;
      data.onQuestionChange?.(data.blockId, value);
    },
    [data],
  );

  return (
    <div
      ref={rootRef}
      className={[
        "qa-block-node",
        data.expanded ? "qa-block-node-expanded" : "qa-block-node-compact",
        selected || data.selected ? "qa-block-selected" : "",
        dragging ? "qa-block-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={handlePointerDown}
      onPointerMove={clearTimer}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
    >
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
        <div className={`qa-block-answer${data.errorMessage ? " qa-block-answer-error" : ""}`}>
          {data.errorMessage ? (
            <p className="qa-block-error-banner" role="alert">
              {data.errorMessage}
            </p>
          ) : null}
          {!data.errorMessage &&
            (data.answer || (data.running ? <span className="streaming-dot" aria-label="Streaming answer" /> : "Answer pending."))}
        </div>
      ) : data.errorMessage ? (
        <div className="qa-block-answer-preview qa-block-answer-error">{data.errorMessage}</div>
      ) : data.answer.trim() ? (
        <div className="qa-block-answer-preview">{data.answer}</div>
      ) : null}
    </div>
  );
});
