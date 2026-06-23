import {
  findQABlock,
  type QABlock,
  type QABlockCanvasDocument,
  type StanceBand,
} from "./domain.ts";
import type { CompiledPromptContext } from "./compiler.ts";

const STANCE_LABELS: Record<StanceBand, string> = {
  critical: "critical",
  neutral: "neutral",
  constructive: "constructive",
};

const STANCE_INTENT: Record<StanceBand, string> = {
  critical: "treat the next prompt as skeptical, corrective, or challenging feedback",
  neutral: "treat the next prompt as a balanced continuation",
  constructive: "treat the next prompt as supportive, additive, or positive feedback",
};

function lineageAncestors(document: QABlockCanvasDocument, blockId: string): QABlock[] {
  const ancestors: QABlock[] = [];
  let currentId: string | null = blockId;
  const visited = new Set<string>();
  while (currentId) {
    const edge = document.edges.find(
      (candidate) => candidate.target === currentId && candidate.meaning === "lineage",
    );
    if (!edge || visited.has(edge.source)) {
      break;
    }
    visited.add(edge.source);
    const parent = document.blocks.find((block) => block.id === edge.source);
    if (!parent) {
      break;
    }
    ancestors.unshift(parent);
    currentId = edge.source;
  }
  return ancestors;
}

function blockStance(block: QABlock): StanceBand {
  return block.metadata.stance ?? "neutral";
}

function renderBlockContext(ancestors: QABlock[], groupSummary: string): string {
  const lines: string[] = [];
  if (groupSummary.trim()) {
    lines.push(`group_summary: ${groupSummary.trim()}`);
  }
  for (const block of ancestors) {
    lines.push(`block: ${block.id}`);
    lines.push(`stance: ${STANCE_LABELS[blockStance(block)]}`);
    lines.push(`question: ${block.question}`);
    lines.push(`answer: ${block.answer}`);
  }
  return lines.join("\n");
}

/** WHY: v2 compiler walks lineage ancestors instead of separate prompt/answer nodes. */
export function compileQABlockContext(
  document: QABlockCanvasDocument,
  blockId: string,
): CompiledPromptContext {
  const block = findQABlock(document, blockId);
  const ancestors = lineageAncestors(document, blockId);
  const contextParent = ancestors.at(-1);
  const stance = contextParent ? blockStance(contextParent) : blockStance(block);
  const group = document.groups.find((candidate) => candidate.id === block.groupId);
  const contextText = renderBlockContext(ancestors, group?.summary ?? "");

  return {
    promptNodeId: blockId,
    stance,
    referencedNodeIds: ancestors.map((ancestor) => ancestor.id),
    contextText,
    messages: [
      {
        role: "system",
        content:
          "You answer from a context canvas. Respect the compiled stance and referenced blocks.",
      },
      {
        role: "user",
        content: [
          contextText,
          `stance_intent: ${STANCE_INTENT[stance]}`,
          "",
          `Current question:\n${block.question}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    trace: [
      ...(group?.summary
        ? [{ nodeId: group.id, reason: "group_summary" as const }]
        : []),
      ...ancestors.map((ancestor) => ({
        nodeId: ancestor.id,
        reason: "context_reference" as const,
      })),
    ],
  };
}
