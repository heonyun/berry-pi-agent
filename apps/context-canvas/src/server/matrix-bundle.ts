import fs from "node:fs";
import path from "node:path";
import type { MatrixDocument, MatrixHistoryEntry } from "../shared/domain.ts";
import { assertSafeId, resolveWithinBundle } from "../storage/markdown/paths.ts";
import { loadMatrixBundle } from "../storage/matrix/load.ts";
import {
  DEFAULT_MATRIX_WORKSPACE_ID,
  projectMatrixToBundle,
} from "../storage/matrix/project.ts";
import type { ContextCanvasServerConfig } from "./security.ts";

function resolveMatrixBundleRootBase(config: ContextCanvasServerConfig, monorepoRoot: string): string {
  if (config.bundleRootBase) {
    return path.resolve(config.bundleRootBase);
  }
  return path.join(monorepoRoot, ".context-matrix-bundles");
}

export function handleMatrixBundleExport(
  body: {
    document: MatrixDocument;
    workspaceId?: string;
    workspaceTitle?: string;
    history?: MatrixHistoryEntry[];
  },
  config: ContextCanvasServerConfig,
  monorepoRoot: string,
): {
  workspaceId: string;
  pathsWritten: string[];
  errors: Array<{ path: string; message: string }>;
} {
  const workspaceId = body.workspaceId ?? DEFAULT_MATRIX_WORKSPACE_ID;
  assertSafeId(workspaceId, "workspaceId");
  const rootBase = resolveMatrixBundleRootBase(config, monorepoRoot);
  const bundleRoot = resolveWithinBundle(rootBase, workspaceId);
  const result = projectMatrixToBundle(body.document, bundleRoot, {
    workspaceId,
    workspaceTitle: body.workspaceTitle ?? body.document.sheet.name,
    historyEntries: body.history,
  });
  return {
    workspaceId,
    pathsWritten: result.pathsWritten,
    errors: result.errors.map((error) => ({
      path: error.path ?? "",
      message: error.message,
    })),
  };
}

export function handleMatrixBundleLoad(
  config: ContextCanvasServerConfig,
  monorepoRoot: string,
  workspaceId = DEFAULT_MATRIX_WORKSPACE_ID,
): {
  document?: MatrixDocument;
  history?: MatrixHistoryEntry[];
  warnings: string[];
  errors: string[];
  statusCode: 200 | 404 | 422 | 500;
} {
  assertSafeId(workspaceId, "workspaceId");
  const rootBase = resolveMatrixBundleRootBase(config, monorepoRoot);
  const bundleRoot = resolveWithinBundle(rootBase, workspaceId);
  const bundleExists = fs.existsSync(bundleRoot);
  try {
    const result = loadMatrixBundle(bundleRoot);
    if (result.document) {
      return {
        document: result.document,
        history: result.history,
        warnings: result.warnings,
        errors: result.errors,
        statusCode: 200,
      };
    }
    return { ...result, statusCode: bundleExists ? 422 : 404 };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { warnings: [], errors: [message], statusCode: 500 };
  }
}
