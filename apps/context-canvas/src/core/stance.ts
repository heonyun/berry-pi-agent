import { compilePromptContext } from "../shared/compiler.ts";
import {
  type ContextCanvasDocument,
  type ContextNode,
  type StanceBand,
  updateNode,
} from "../shared/domain.ts";
import { lineageParent } from "./mutations.ts";

export function stanceForNode(document: ContextCanvasDocument, node: ContextNode): StanceBand {
  if (node.kind === "prompt_input") {
    const parent = lineageParent(document, node.id);
    if (!parent) {
      return "neutral";
    }
    try {
      return compilePromptContext(document, node.id).stance;
    } catch {
      return node.metadata.stance ?? "neutral";
    }
  }
  return node.metadata.stance ?? "neutral";
}

export function setAnswerTextOnDocument(
  document: ContextCanvasDocument,
  answerId: string,
  text: string,
): ContextCanvasDocument {
  return updateNode(document, answerId, (node) => {
    if (node.kind !== "ai_answer") {
      return node;
    }
    const versions = node.stack?.versions ?? [];
    const activeId = node.stack?.activeVersionId;
    const nextVersions = versions.map((version) =>
      version.id === activeId ? { ...version, text } : version,
    );
    return {
      ...node,
      text,
      stack: {
        activeVersionId: activeId ?? `${node.id}-v1`,
        versions: nextVersions.length
          ? nextVersions
          : [{ id: `${node.id}-v1`, text, createdAt: new Date().toISOString() }],
      },
    };
  });
}
