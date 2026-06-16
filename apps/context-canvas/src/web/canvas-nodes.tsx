import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { INITIAL_PROMPT_TEXT } from "../shared/domain.ts";
import type { StanceBand } from "../shared/domain.ts";
import type { AnswerNodeData, PromptNodeData } from "../adapters/react-flow.ts";
import { ImeTextarea, stopNodeKeyPropagation } from "./ImeTextarea.tsx";

function stanceClass(stance: StanceBand): string {
  return `stance-${stance}`;
}

export const PromptInputNode = memo(function PromptInputNode({
  data,
  dragging,
}: NodeProps<Node<PromptNodeData>>) {
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

export const AIAnswerNode = memo(function AIAnswerNode({
  data,
  dragging,
}: NodeProps<Node<AnswerNodeData>>) {
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
        {(["agree", "disagree", "unsure"] as const).map((feedback) => (
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

export const canvasNodeTypes = {
  promptInput: PromptInputNode,
  aiAnswer: AIAnswerNode,
};
