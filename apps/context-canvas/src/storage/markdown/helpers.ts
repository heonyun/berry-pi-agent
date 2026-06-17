import { compilePromptContext } from "../../shared/compiler.ts";
import {
  type ContextCanvasDocument,
  type ContextNode,
  type StanceBand,
} from "../../shared/domain.ts";

export function resolveNodeStance(document: ContextCanvasDocument, node: ContextNode): StanceBand {
  if (node.kind === "prompt_input") {
    try {
      return compilePromptContext(document, node.id).stance;
    } catch {
      return node.metadata.stance ?? "neutral";
    }
  }
  return node.metadata.stance ?? "neutral";
}

export function lineageParentId(document: ContextCanvasDocument, nodeId: string): string | null {
  const edge = document.edges.find(
    (candidate) => candidate.target === nodeId && candidate.meaning === "lineage",
  );
  return edge?.source ?? null;
}

export function contextReferenceIds(document: ContextCanvasDocument, nodeId: string): string[] {
  return document.edges
    .filter((edge) => edge.target === nodeId && edge.meaning === "context_reference")
    .map((edge) => edge.source);
}

export function nodeLink(nodeId: string): string {
  return `[${nodeId}](../nodes/${nodeId}.md)`;
}

export function nodeTitle(node: ContextNode): string {
  if (node.kind === "prompt_input") {
    const preview = node.text.trim().split(/\s+/).slice(0, 6).join(" ");
    return preview || node.id;
  }
  const preview = node.text.trim().split(/\s+/).slice(0, 6).join(" ");
  return preview || node.id;
}

export function nodeDescription(node: ContextNode): string {
  if (node.kind === "prompt_input") {
    return "Prompt input node.";
  }
  return "AI answer node.";
}

export function readBodyMainText(body: string): string {
  const sections = ["# Lineage", "# Context References", "# Versions", "# Compiled Snapshot"];
  let cut = body.length;
  for (const heading of sections) {
    const index = body.indexOf(`\n${heading}`);
    if (index >= 0) {
      cut = Math.min(cut, index);
    }
    if (body.startsWith(heading)) {
      cut = 0;
    }
  }
  return body.slice(0, cut).trim();
}
