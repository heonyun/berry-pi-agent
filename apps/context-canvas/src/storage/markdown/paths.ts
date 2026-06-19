import path from "node:path";

export const NODES_DIR = "nodes";
export const GROUPS_DIR = "groups";
export const COMPILED_DIR = "compiled";
export const CANVAS_SIDECAR = "_canvas.json";
export const ROOT_INDEX = "index.md";

const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export class BundlePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BundlePathError";
  }
}

export function assertSafeId(id: string, label: string): void {
  if (!SAFE_ID_RE.test(id)) {
    throw new BundlePathError(`Invalid ${label}: ${id}`);
  }
}

export function resolveWithinBundle(bundleRoot: string, ...segments: string[]): string {
  const resolved = path.resolve(bundleRoot, ...segments);
  const root = path.resolve(bundleRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new BundlePathError(`Path escapes bundle root: ${resolved}`);
  }
  return resolved;
}

export function normalizeBundleRelativePath(bundleRoot: string, targetPath: string): string {
  const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.resolve(bundleRoot, targetPath);
  return path.relative(bundleRoot, absolutePath).split(path.sep).join("/");
}

export function nodeIdToPath(bundleRoot: string, nodeId: string): string {
  assertSafeId(nodeId, "nodeId");
  return resolveWithinBundle(bundleRoot, NODES_DIR, `${nodeId}.md`);
}

export function pathToNodeId(bundleRoot: string, filePath: string): string | undefined {
  const relative = path.relative(bundleRoot, filePath);
  const match = /^nodes[/\\](.+)\.md$/.exec(relative);
  const nodeId = match?.[1];
  if (!nodeId) {
    return undefined;
  }
  try {
    assertSafeId(nodeId, "nodeId");
    return nodeId;
  } catch {
    return undefined;
  }
}

export function groupIdToDir(bundleRoot: string, groupId: string): string {
  assertSafeId(groupId, "groupId");
  return resolveWithinBundle(bundleRoot, GROUPS_DIR, groupId);
}

export function groupIndexPath(bundleRoot: string, groupId: string): string {
  return path.join(groupIdToDir(bundleRoot, groupId), ROOT_INDEX);
}

export function compiledPromptPath(bundleRoot: string, promptNodeId: string): string {
  assertSafeId(promptNodeId, "promptNodeId");
  return resolveWithinBundle(bundleRoot, COMPILED_DIR, `${promptNodeId}.md`);
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
