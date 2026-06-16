import fs from "node:fs";
import path from "node:path";
import type {
  AIAnswerNode,
  ContextCanvasDocument,
  ContextEdge,
  ContextGroup,
  ContextNode,
  FeedbackState,
  NodeKind,
  PromptInputNode,
  StanceBand,
  Vec2,
} from "../../shared/domain.ts";
import { parse } from "./document.ts";
import { readBodyMainText } from "./helpers.ts";
import {
  CANVAS_SIDECAR,
  nodesDir,
  pathToNodeId,
} from "./paths.ts";
import { readBundleDocument } from "./sidecar.ts";
import type { LoadResult } from "./types.ts";

export function loadBundleToDocument(bundleRoot: string): LoadResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(bundleRoot)) {
    return { warnings, errors: [`Bundle directory not found: ${bundleRoot}`] };
  }

  const sidecar = readBundleDocument(bundleRoot);
  if (sidecar) {
    return {
      document: sidecar,
      warnings: [
        `Loaded canonical snapshot from ${CANVAS_SIDECAR}. Markdown files were not re-parsed.`,
      ],
      errors,
    };
  }

  warnings.push(`Missing ${CANVAS_SIDECAR}; loading best-effort from node markdown files.`);

  const nodeFiles = listNodeFiles(bundleRoot);
  if (nodeFiles.length === 0) {
    return { warnings, errors: ["No node markdown files found."] };
  }

  const nodes: ContextNode[] = [];
  for (const filePath of nodeFiles) {
    try {
      const node = parseNodeFile(filePath, bundleRoot, warnings);
      if (node) {
        nodes.push(node);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${path.relative(bundleRoot, filePath)}: ${message}`);
    }
  }

  if (nodes.length === 0) {
    return { warnings, errors: errors.length ? errors : ["No nodes could be loaded."] };
  }

  const edges = buildEdgesFromFrontmatter(nodes, nodeFiles, bundleRoot, warnings);
  const groups = buildGroups(nodes, warnings);
  const canvasId = readCanvasId(nodeFiles, bundleRoot, warnings);
  const document: ContextCanvasDocument = {
    schemaVersion: 1,
    canvas: {
      id: canvasId,
      title: "Loaded Context Canvas",
    },
    groups,
    nodes,
    edges,
  };

  return { document, warnings, errors };
}

function listNodeFiles(bundleRoot: string): string[] {
  const dir = nodesDir(bundleRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(dir, name))
    .sort();
}

function parseNodeFile(filePath: string, bundleRoot: string, warnings: string[]): ContextNode | undefined {
  const nodeId = pathToNodeId(bundleRoot, filePath);
  if (!nodeId) {
    warnings.push(`Skipping unrecognized node path: ${filePath}`);
    return undefined;
  }

  const markdown = parse(fs.readFileSync(filePath, "utf8"));
  const kind = readNodeKind(markdown.frontmatter.type, nodeId, warnings);
  if (!kind) {
    return undefined;
  }

  const position = readPosition(markdown.frontmatter.position, nodeId, warnings);
  const groupId = String(markdown.frontmatter.group ?? "group-1");
  const stance = readStance(markdown.frontmatter.stance);
  const text = readBodyMainText(markdown.body);

  const base = {
    id: nodeId,
    groupId,
    text,
    position,
    metadata: { stance },
  };

  if (kind === "prompt_input") {
    return {
      ...base,
      kind,
    } satisfies PromptInputNode;
  }

  const answer: AIAnswerNode = {
    ...base,
    kind,
    feedback: readFeedback(markdown.frontmatter.feedback),
  };

  const activeVersionId = markdown.frontmatter.active_version_id;
  if (typeof activeVersionId === "string" && activeVersionId.length > 0) {
    answer.stack = {
      activeVersionId,
      versions: [
        {
          id: activeVersionId,
          text,
          createdAt: String(markdown.frontmatter.timestamp ?? new Date().toISOString()),
          feedback: answer.feedback,
        },
      ],
    };
  }

  return answer;
}

function buildEdgesFromFrontmatter(
  nodes: ContextNode[],
  nodeFiles: string[],
  bundleRoot: string,
  warnings: string[],
): ContextEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: ContextEdge[] = [];
  const seen = new Set<string>();

  for (const filePath of nodeFiles) {
    const nodeId = pathToNodeId(bundleRoot, filePath);
    if (!nodeId) {
      continue;
    }
    const markdown = parse(fs.readFileSync(filePath, "utf8"));
    const lineageParent = markdown.frontmatter.lineage_parent;
    if (typeof lineageParent === "string" && lineageParent.length > 0) {
      if (!nodeIds.has(lineageParent)) {
        warnings.push(`Broken lineage parent ${lineageParent} for ${nodeId}`);
      } else {
        addEdge(edges, seen, lineageParent, nodeId, "lineage");
      }
    }

    const contextRefs = markdown.frontmatter.context_refs;
    if (Array.isArray(contextRefs)) {
      for (const refId of contextRefs) {
        const source = String(refId);
        if (!nodeIds.has(source)) {
          warnings.push(`Broken context reference ${source} for ${nodeId}`);
          continue;
        }
        addEdge(edges, seen, source, nodeId, "context_reference");
      }
    }
  }

  return edges;
}

function addEdge(
  edges: ContextEdge[],
  seen: Set<string>,
  source: string,
  target: string,
  meaning: ContextEdge["meaning"],
): void {
  const id = `edge-${meaning}-${source}-${target}`;
  const key = `${meaning}:${source}:${target}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  edges.push({ id, source, target, meaning });
}

function buildGroups(nodes: ContextNode[], warnings: string[]): ContextGroup[] {
  const groups = new Map<string, ContextGroup>();
  for (const node of nodes) {
    if (!groups.has(node.groupId)) {
      groups.set(node.groupId, {
        id: node.groupId,
        title: node.groupId,
        origin: { x: 0, y: 0 },
      });
    }
  }
  if (groups.size === 0) {
    warnings.push("No groups inferred from nodes; using default group.");
    groups.set("group-1", { id: "group-1", title: "Conversation", origin: { x: 0, y: 0 } });
  }
  return [...groups.values()];
}

function readNodeKind(value: unknown, nodeId: string, warnings: string[]): NodeKind | undefined {
  if (value === "prompt_input" || value === "ai_answer") {
    return value;
  }
  warnings.push(`Unknown node kind for ${nodeId}; skipping.`);
  return undefined;
}

function readPosition(value: unknown, nodeId: string, warnings: string[]): Vec2 {
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const x = Number(record.x ?? 0);
    const y = Number(record.y ?? 0);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }
  warnings.push(`Invalid position for ${nodeId}; defaulting to origin.`);
  return { x: 0, y: 0 };
}

function readStance(value: unknown): StanceBand | undefined {
  if (value === "critical" || value === "neutral" || value === "constructive") {
    return value;
  }
  return undefined;
}

function readFeedback(value: unknown): FeedbackState | undefined {
  if (value === "agree" || value === "disagree" || value === "unsure" || value === "needs_retry") {
    return value;
  }
  return undefined;
}

function readCanvasId(nodeFiles: string[], bundleRoot: string, warnings: string[]): string {
  for (const filePath of nodeFiles) {
    try {
      const markdown = parse(fs.readFileSync(filePath, "utf8"));
      const canvas = markdown.frontmatter.canvas;
      if (typeof canvas === "string" && canvas.length > 0) {
        return canvas;
      }
    } catch {
      warnings.push(`Could not read canvas id from ${path.relative(bundleRoot, filePath)}`);
    }
  }
  return "canvas-1";
}
