import fs from "node:fs";
import path from "node:path";
import type { ContextCanvasDocument, ContextNode } from "../../shared/domain.ts";
import { nodeDescription, nodeTitle } from "./helpers.ts";
import { serialize } from "./document.ts";
import { groupIndexPath, groupIdToDir, normalizeBundleRelativePath, rootIndexPath } from "./paths.ts";

const INDEX_FILE = "index.md";

export function regenerateIndexes(bundleRoot: string, document: ContextCanvasDocument): string[] {
  const written: string[] = [];

  for (const group of document.groups) {
    const groupDir = groupIdToDir(bundleRoot, group.id);
    fs.mkdirSync(groupDir, { recursive: true });
    const groupNodes = document.nodes.filter((node) => node.groupId === group.id);
    const indexPath = groupIndexPath(bundleRoot, group.id);
    fs.writeFileSync(indexPath, buildGroupIndexText(group, groupNodes), "utf8");
    written.push(normalizeBundleRelativePath(bundleRoot, indexPath));
  }

  const rootPath = rootIndexPath(bundleRoot);
  fs.writeFileSync(rootPath, buildRootIndexText(document), "utf8");
  written.push(normalizeBundleRelativePath(bundleRoot, rootPath));

  return written;
}

function buildRootIndexText(document: ContextCanvasDocument): string {
  const lines = [
    `# ${document.canvas.title}`,
    "",
    `Canvas ID: \`${document.canvas.id}\``,
    "",
    "# Groups",
    "",
    ...document.groups.map(
      (group) =>
        `* [${group.title}](${path.posix.join("groups", group.id, INDEX_FILE)}) - ${group.title}`,
    ),
    "",
    "# Nodes",
    "",
    ...groupNodesByType(document.nodes).flatMap(([type, nodes]) => [
      `## ${type}`,
      "",
      ...nodes.map(
        (node) =>
          `* [${nodeTitle(node)}](${path.posix.join("nodes", `${node.id}.md`)}) - ${nodeDescription(node)}`,
      ),
      "",
    ]),
  ];
  return `${lines.join("\n").trim()}\n`;
}

function buildGroupIndexText(group: ContextCanvasDocument["groups"][number], nodes: ContextNode[]): string {
  const bodyLines = [
    `# ${group.title}`,
    "",
    `Group ID: \`${group.id}\``,
    "",
    "# Summary",
    "",
    group.summary?.trim() || "(empty)",
    "",
    "# Nodes",
    "",
    ...nodes.map(
      (node) =>
        `* [${nodeTitle(node)}](${path.posix.join("..", "nodes", `${node.id}.md`)}) - ${nodeDescription(node)}`,
    ),
    "",
  ];
  return serialize({
    frontmatter: {
      type: "context_group",
      title: group.title,
      group: group.id,
      origin: group.origin,
      summary: group.summary ?? "",
      member_ids: nodes.map((node) => node.id),
      updated_at: group.updatedAt,
    },
    body: bodyLines.join("\n"),
  });
}

function groupNodesByType(nodes: ContextNode[]): Array<[string, ContextNode[]]> {
  const grouped = new Map<string, ContextNode[]>();
  for (const node of nodes) {
    const bucket = grouped.get(node.kind) ?? [];
    bucket.push(node);
    grouped.set(node.kind, bucket);
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
}
