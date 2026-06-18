import {
  type ContextCanvasDocument,
  type ContextNode,
  type FeedbackState,
  type StanceBand,
  calculateStanceBand,
  findNode,
} from "./domain.ts";

export interface CompiledPromptContext {
  promptNodeId: string;
  stance: StanceBand;
  referencedNodeIds: string[];
  contextText: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  trace: Array<{ nodeId: string; reason: string; feedback?: FeedbackState }>;
}

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

export function compilePromptContext(
  document: ContextCanvasDocument,
  promptNodeId: string,
): CompiledPromptContext {
  const promptNode = findNode(document, promptNodeId);
  if (promptNode.kind !== "prompt_input") {
    throw new Error(`Node ${promptNodeId} is not a prompt_input node.`);
  }

  const parentNode = findLineageParent(document, promptNode.id);
  const stance = parentNode
    ? calculateStanceBand(promptNode.position, parentNode.position)
    : "neutral";
  const references = findReferenceNodes(document, promptNode.id);
  const group = document.groups.find((candidate) => candidate.id === promptNode.groupId);
  const referenceIds = new Set(references.map((node) => node.id));
  const groupMembers = document.nodes.filter(
    (node) =>
      node.groupId === promptNode.groupId &&
      node.id !== promptNode.id &&
      !referenceIds.has(node.id),
  );
  const contextText = renderContextText({
    references,
    stance,
    groupSummary: group?.summary ?? "",
    groupMembers,
  });

  return {
    promptNodeId: promptNode.id,
    stance,
    referencedNodeIds: references.map((node) => node.id),
    contextText,
    messages: [
      {
        role: "system",
        content:
          "You answer from a context canvas. Respect the compiled stance and referenced nodes.",
      },
      {
        role: "user",
        content: `${contextText}\n\nCurrent prompt:\n${promptNode.text}`,
      },
    ],
    trace: [
      ...(group?.summary
        ? [
            {
              nodeId: group.id,
              reason: "group_summary",
            },
          ]
        : []),
      ...references.map((node) => ({
        nodeId: node.id,
        reason: "context_reference",
        feedback: node.kind === "ai_answer" ? node.feedback : undefined,
      })),
    ],
  };
}

export function formatPromptForPi(compiled: CompiledPromptContext): string {
  const stanceLabel = STANCE_LABELS[compiled.stance];
  const system = compiled.messages.find((message) => message.role === "system")?.content ?? "";
  const user = compiled.messages.find((message) => message.role === "user")?.content ?? "";
  return [
    system,
    "",
    `Stance band: ${stanceLabel}`,
    "",
    user,
  ]
    .join("\n")
    .trim();
}

function findLineageParent(
  document: ContextCanvasDocument,
  promptNodeId: string,
): ContextNode | undefined {
  const edge = document.edges.find(
    (candidate) => candidate.target === promptNodeId && candidate.meaning === "lineage",
  );
  return edge ? findNode(document, edge.source) : undefined;
}

function findReferenceNodes(document: ContextCanvasDocument, promptNodeId: string): ContextNode[] {
  const referenceIds = document.edges
    .filter((edge) => edge.target === promptNodeId && edge.meaning === "context_reference")
    .map((edge) => edge.source);
  return referenceIds.map((nodeId) => findNode(document, nodeId));
}

function renderContextText({
  references,
  stance,
  groupSummary,
  groupMembers,
}: {
  references: ContextNode[];
  stance: StanceBand;
  groupSummary: string;
  groupMembers: ContextNode[];
}): string {
  const lines = [`stance: ${STANCE_LABELS[stance]}`];
  lines.push(`stance_intent: ${STANCE_INTENT[stance]}`);
  if (groupSummary.trim()) {
    lines.push(`group_summary: ${groupSummary.trim()}`);
  }
  for (const node of groupMembers) {
    lines.push(`group_member: ${node.id}`);
    lines.push(`kind: ${node.kind}`);
    if (node.kind === "ai_answer" && node.feedback) {
      lines.push(`feedback: ${node.feedback}`);
    }
    lines.push(`text: ${node.text}`);
  }
  for (const node of references) {
    lines.push(`reference: ${node.id}`);
    lines.push(`kind: ${node.kind}`);
    if (node.kind === "ai_answer" && node.feedback) {
      lines.push(`feedback: ${node.feedback}`);
    }
    lines.push(`text: ${node.text}`);
  }
  return lines.join("\n");
}
