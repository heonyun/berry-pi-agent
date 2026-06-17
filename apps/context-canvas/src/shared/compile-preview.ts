import type { CompiledPromptContext } from "./compiler.ts";
import type { ContextCanvasDocument } from "./domain.ts";

const STANCE_LABELS = {
  critical: "critical",
  neutral: "neutral",
  constructive: "constructive",
} as const;

export interface NodeBacklink {
  nodeId: string;
  reason: "uses_as_context" | "lineage_child";
}

export function formatCompiledPreviewMarkdown(compiled: CompiledPromptContext): string {
  const lines = [
    `# Compiled Prompt: ${compiled.promptNodeId}`,
    "",
    `**Stance:** ${STANCE_LABELS[compiled.stance]}`,
    "",
    "## Trace",
    "",
  ];

  if (compiled.trace.length === 0) {
    lines.push("_No referenced nodes._");
  } else {
    for (const entry of compiled.trace) {
      const feedback = entry.feedback ? ` · feedback: ${entry.feedback}` : "";
      lines.push(`- \`${entry.nodeId}\` (${entry.reason}${feedback})`);
    }
  }

  lines.push("", "## Context", "", "```text", compiled.contextText, "```", "", "## Prompt Payload", "");
  const userMessage = compiled.messages.find((message) => message.role === "user")?.content ?? "";
  lines.push("```text", userMessage, "```");
  return lines.join("\n");
}

export function buildNodeBacklinks(document: ContextCanvasDocument, nodeId: string): NodeBacklink[] {
  const backlinks: NodeBacklink[] = [];
  const seen = new Set<string>();

  for (const edge of document.edges) {
    if (edge.source === nodeId && edge.meaning === "context_reference") {
      const key = `uses_as_context:${edge.target}`;
      if (!seen.has(key)) {
        seen.add(key);
        backlinks.push({ nodeId: edge.target, reason: "uses_as_context" });
      }
    }
    if (edge.source === nodeId && edge.meaning === "lineage") {
      const key = `lineage_child:${edge.target}`;
      if (!seen.has(key)) {
        seen.add(key);
        backlinks.push({ nodeId: edge.target, reason: "lineage_child" });
      }
    }
  }

  return backlinks.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}
