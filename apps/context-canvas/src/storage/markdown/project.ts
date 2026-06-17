import fs from "node:fs";
import path from "node:path";
import type { CompiledPromptContext } from "../../shared/compiler.ts";
import { formatPromptForPi } from "../../shared/compiler.ts";
import type { ContextCanvasDocument, ContextNode } from "../../shared/domain.ts";
import { parse, serialize, type MarkdownDocument } from "./document.ts";
import {
  contextReferenceIds,
  lineageParentId,
  nodeDescription,
  nodeLink,
  nodeTitle,
  resolveNodeStance,
} from "./helpers.ts";
import { regenerateIndexes } from "./index.ts";
import {
  COMPILED_DIR,
  GROUPS_DIR,
  NODES_DIR,
  compiledPromptPath,
  groupIdToDir,
  nodeIdToPath,
} from "./paths.ts";
import { CANVAS_SIDECAR, writeBundleDocument } from "./sidecar.ts";
import type { NodeProjectionFrontmatter, ProjectOptions, ProjectResult, ProjectionError } from "./types.ts";

function toBundleRelativePath(bundleRoot: string, absolutePath: string): string {
  return path.relative(bundleRoot, absolutePath).split(path.sep).join("/");
}

export function projectDocumentToBundle(
  document: ContextCanvasDocument,
  bundleRoot: string,
  options: ProjectOptions = {},
): ProjectResult {
  const {
    includeCompiled = false,
    compiledByPromptId = new Map<string, CompiledPromptContext>(),
    writeCanvasSidecar = true,
  } = options;

  const pathsWritten: string[] = [];
  const errors: ProjectionError[] = [];

  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.mkdirSync(path.join(bundleRoot, NODES_DIR), { recursive: true });
  fs.mkdirSync(path.join(bundleRoot, GROUPS_DIR), { recursive: true });
  if (includeCompiled) {
    fs.mkdirSync(path.join(bundleRoot, COMPILED_DIR), { recursive: true });
  }

  for (const group of document.groups) {
    fs.mkdirSync(groupIdToDir(bundleRoot, group.id), { recursive: true });
  }

  const existingSnapshots = new Map<string, number>();

  for (const node of document.nodes) {
    const nodePath = nodeIdToPath(bundleRoot, node.id);
    if (fs.existsSync(nodePath)) {
      try {
        const existing = parse(fs.readFileSync(nodePath, "utf8"));
        existingSnapshots.set(node.id, countCompiledTraceLines(existing.body));
      } catch {
        // ignore unreadable prior snapshot metadata
      }
    }

    const markdown = buildNodeMarkdown(document, node, {
      includeCompiled,
      compiledByPromptId,
      existingTraceLines: existingSnapshots.get(node.id),
      errors,
      nodePath,
    });
    fs.writeFileSync(nodePath, serialize(markdown), "utf8");
    pathsWritten.push(toBundleRelativePath(bundleRoot, nodePath));
  }

  if (includeCompiled) {
    for (const [promptNodeId, compiled] of compiledByPromptId.entries()) {
      const compiledPath = compiledPromptPath(bundleRoot, promptNodeId);
      const compiledDoc: MarkdownDocument = {
        frontmatter: {
          type: "compiled_prompt",
          prompt_node_id: promptNodeId,
          stance: compiled.stance,
          referenced_node_ids: compiled.referencedNodeIds,
          timestamp: new Date().toISOString(),
        },
        body: [
          "# Compiled Prompt",
          "",
          "```text",
          formatPromptForPi(compiled),
          "```",
          "",
          "# Trace",
          ...compiled.trace.map(
            (entry) =>
              `- ${entry.nodeId} (${entry.reason}${entry.feedback ? `, feedback: ${entry.feedback}` : ""})`,
          ),
        ].join("\n"),
      };
      fs.writeFileSync(compiledPath, serialize(compiledDoc), "utf8");
      pathsWritten.push(toBundleRelativePath(bundleRoot, compiledPath));
    }
  }

  if (writeCanvasSidecar) {
    writeBundleDocument(bundleRoot, document);
    pathsWritten.push(CANVAS_SIDECAR);
  }

  for (const indexPath of regenerateIndexes(bundleRoot, document)) {
    pathsWritten.push(toBundleRelativePath(bundleRoot, indexPath));
  }

  return { pathsWritten, errors };
}

function buildNodeMarkdown(
  document: ContextCanvasDocument,
  node: ContextNode,
  options: {
    includeCompiled: boolean;
    compiledByPromptId: Map<string, CompiledPromptContext>;
    existingTraceLines?: number;
    errors: ProjectionError[];
    nodePath: string;
  },
): MarkdownDocument {
  const lineageParent = lineageParentId(document, node.id);
  const contextRefs = contextReferenceIds(document, node.id);
  const frontmatter: NodeProjectionFrontmatter = {
    type: node.kind,
    title: nodeTitle(node),
    description: nodeDescription(node),
    canvas: document.canvas.id,
    group: node.groupId,
    position: node.position,
    stance: resolveNodeStance(document, node),
    lineage_parent: lineageParent,
    context_refs: contextRefs,
    timestamp: new Date().toISOString(),
  };

  if (node.kind === "ai_answer") {
    if (node.feedback) {
      frontmatter.feedback = node.feedback;
    }
    if (node.stack?.activeVersionId) {
      frontmatter.active_version_id = node.stack.activeVersionId;
    }
  }

  const bodyParts = [node.text.trim()];
  if (lineageParent) {
    bodyParts.push("", "# Lineage", "", `Parent: ${nodeLink(lineageParent)}`);
  }
  if (contextRefs.length > 0) {
    bodyParts.push(
      "",
      "# Context References",
      "",
      ...contextRefs.map((refId) => `- ${nodeLink(refId)}`),
    );
  }
  if (node.kind === "ai_answer" && node.stack?.versions.length) {
    bodyParts.push(
      "",
      "# Versions",
      "",
      ...node.stack.versions.map(
        (version) =>
          `- ${version.id} (${version.createdAt}${version.feedback ? `, ${version.feedback}` : ""})`,
      ),
    );
  }

  if (options.includeCompiled && node.kind === "prompt_input") {
    const compiled = options.compiledByPromptId.get(node.id);
    if (compiled) {
      const nextTraceLines = compiled.trace.length;
      if (
        options.existingTraceLines !== undefined &&
        nextTraceLines < options.existingTraceLines
      ) {
        options.errors.push({
          code: "augmentation_guard",
          message: `Refusing to shrink compiled snapshot trace for ${node.id}.`,
          path: options.nodePath,
        });
      } else {
        bodyParts.push(
          "",
          "# Compiled Snapshot",
          "",
          "```text",
          formatPromptForPi(compiled),
          "```",
          "",
          "# Trace",
          ...compiled.trace.map(
            (entry) =>
              `- ${entry.nodeId} (${entry.reason}${entry.feedback ? `, feedback: ${entry.feedback}` : ""})`,
          ),
        );
      }
    }
  }

  return { frontmatter, body: bodyParts.filter((part, index) => !(index > 0 && part === "" && bodyParts[index - 1] === "")).join("\n").trim() + "\n" };
}

function countCompiledTraceLines(body: string): number {
  const marker = "# Trace";
  const index = body.indexOf(marker);
  if (index < 0) {
    return 0;
  }
  return body
    .slice(index)
    .split("\n")
    .filter((line) => line.trim().startsWith("- ")).length;
}
