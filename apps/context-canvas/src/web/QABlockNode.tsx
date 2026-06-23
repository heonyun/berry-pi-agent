import { memo, useState } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import type { StanceBand } from "../shared/domain.ts";

export interface QABlockNodeData {
  blockId: string;
  question: string;
  answer: string;
  stance: StanceBand;
  expanded: boolean;
  running: boolean;
  [key: string]: unknown;
}

/** TODO: issue-39 — compact/expand UI, in-block question edit, AnswerStack versions. */
export const QABlockNode = memo(function QABlockNode({
  data,
}: NodeProps<Node<QABlockNodeData>>) {
  const [expanded, setExpanded] = useState(data.expanded);

  return (
    <div
      className={`qa-block-node ${expanded ? "qa-block-node-expanded" : "qa-block-node-compact"}`}
      onClick={() => setExpanded((value) => !value)}
    >
      <header className="qa-block-header">
        <span>Q&A Block</span>
        <span className={`stance-${data.stance}`}>{data.stance}</span>
      </header>
      <div className="qa-block-question">{data.question || "Question…"}</div>
      {expanded ? (
        <div className="qa-block-answer">
          {data.answer || (data.running ? "Streaming…" : "Answer pending.")}
        </div>
      ) : null}
    </div>
  );
});
