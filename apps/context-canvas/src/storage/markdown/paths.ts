import path from "node:path";

export const NODES_DIR = "nodes";
export const GROUPS_DIR = "groups";
export const COMPILED_DIR = "compiled";
export const CANVAS_SIDECAR = "_canvas.json";
export const ROOT_INDEX = "index.md";

export function nodeIdToPath(bundleRoot: string, nodeId: string): string {
  return path.join(bundleRoot, NODES_DIR, `${nodeId}.md`);
}

export function pathToNodeId(bundleRoot: string, filePath: string): string | undefined {
  const relative = path.relative(bundleRoot, filePath);
  const match = /^nodes[/\\](.+)\.md$/.exec(relative);
  return match?.[1];
}

export function groupIdToDir(bundleRoot: string, groupId: string): string {
  return path.join(bundleRoot, GROUPS_DIR, groupId);
}

export function groupIndexPath(bundleRoot: string, groupId: string): string {
  return path.join(groupIdToDir(bundleRoot, groupId), ROOT_INDEX);
}

export function compiledPromptPath(bundleRoot: string, promptNodeId: string): string {
  return path.join(bundleRoot, COMPILED_DIR, `${promptNodeId}.md`);
}

export function canvasSidecarPath(bundleRoot: string): string {
  return path.join(bundleRoot, CANVAS_SIDECAR);
}

export function rootIndexPath(bundleRoot: string): string {
  return path.join(bundleRoot, ROOT_INDEX);
}

export function nodesDir(bundleRoot: string): string {
  return path.join(bundleRoot, NODES_DIR);
}
