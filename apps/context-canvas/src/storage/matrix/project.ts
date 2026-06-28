import fs from "node:fs";
import path from "node:path";
import type { MatrixDocument } from "../../shared/domain.ts";
import { serialize } from "../markdown/document.ts";
import { assertSafeId } from "../markdown/paths.ts";
import { regenerateMatrixIndexes } from "./index.ts";
import {
  CELLS_DIR,
  cellCoordToPath,
  HISTORY_DIR,
  normalizeBundleRelativePath,
  templatePath,
  TEMPLATES_DIR,
} from "./paths.ts";
import { writeMatrixHistory } from "./history.ts";
import { buildMatrixManifest, writeMatrixManifest } from "./sidecar.ts";
import { MATRIX_SIDECAR } from "./sidecar.ts";
import type { MatrixCellProjectionFrontmatter, ProjectOptions, ProjectResult, ProjectionError } from "./types.ts";

export const DEFAULT_MATRIX_WORKSPACE_ID = "matrix-1";

function rollbackProjection(bundleRoot: string, relativePaths: readonly string[]): void {
  for (const relative of relativePaths) {
    const absolute = path.join(bundleRoot, relative);
    try {
      if (fs.existsSync(absolute)) {
        fs.rmSync(absolute, { force: true });
      }
    } catch {
      // Best-effort rollback after a failed write.
    }
  }
}

function failProjection(
  bundleRoot: string,
  pathsWritten: string[],
  errors: ProjectionError[],
  error: ProjectionError,
): ProjectResult {
  rollbackProjection(bundleRoot, pathsWritten);
  return { pathsWritten: [], errors: [...errors, error] };
}

function writeProjectionFile(
  bundleRoot: string,
  absolutePath: string,
  content: string,
  pathsWritten: string[],
  errors: ProjectionError[],
): ProjectResult | undefined {
  try {
    fs.writeFileSync(absolutePath, content, "utf8");
    pathsWritten.push(normalizeBundleRelativePath(bundleRoot, absolutePath));
    return undefined;
  } catch (writeError: unknown) {
    const message = writeError instanceof Error ? writeError.message : String(writeError);
    return failProjection(bundleRoot, pathsWritten, errors, {
      code: "write_failed",
      message,
      path: normalizeBundleRelativePath(bundleRoot, absolutePath),
    });
  }
}

export function projectMatrixToBundle(
  document: MatrixDocument,
  bundleRoot: string,
  options: ProjectOptions = {},
): ProjectResult {
  const {
    workspaceId = DEFAULT_MATRIX_WORKSPACE_ID,
    workspaceTitle = document.sheet.name,
    writeMatrixSidecar = true,
    historyEntries,
  } = options;

  assertSafeId(workspaceId, "workspaceId");
  assertSafeId(document.sheet.id, "sheetId");

  const pathsWritten: string[] = [];
  const errors: ProjectResult["errors"] = [];

  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.mkdirSync(path.join(bundleRoot, CELLS_DIR), { recursive: true });

  for (const [key, cell] of document.sheet.cells.entries()) {
    const [rowText, colText] = key.split(",");
    const row = Number.parseInt(rowText!, 10);
    const col = Number.parseInt(colText!, 10);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      errors.push({
        code: "invalid_cell_key",
        message: `Invalid cell map key: ${key}`,
      });
      continue;
    }
    if (row < 0 || col < 0) {
      errors.push({
        code: "invalid_cell_key",
        message: `Cell coordinates must be non-negative: ${key}`,
      });
      continue;
    }
    if (row >= document.sheet.rows || col >= document.sheet.cols) {
      errors.push({
        code: "out_of_range_cell",
        message: `Cell ${row},${col} is outside sheet dimensions ${document.sheet.rows}×${document.sheet.cols}`,
      });
      continue;
    }

    const cellPath = cellCoordToPath(bundleRoot, row, col);
    const frontmatter: MatrixCellProjectionFrontmatter = {
      type: "matrix_cell",
      row,
      col,
      timestamp: new Date().toISOString(),
    };
    if (cell.value !== null) {
      frontmatter.value = cell.value;
    }
    if (cell.provenance) {
      frontmatter.provenance = cell.provenance;
    }
    if (cell.frontmatter.trim()) {
      frontmatter.frontmatter_yaml = cell.frontmatter;
    }

    const writeResult = writeProjectionFile(
      bundleRoot,
      cellPath,
      serialize({ frontmatter, body: cell.body }),
      pathsWritten,
      errors,
    );
    if (writeResult) {
      return writeResult;
    }
  }

  if (document.template) {
    fs.mkdirSync(path.join(bundleRoot, TEMPLATES_DIR), { recursive: true });
    const templateFile = templatePath(bundleRoot, document.template.id);
    const writeResult = writeProjectionFile(
      bundleRoot,
      templateFile,
      `${JSON.stringify(document.template, null, 2)}\n`,
      pathsWritten,
      errors,
    );
    if (writeResult) {
      return writeResult;
    }
  }

  if (writeMatrixSidecar) {
    try {
      writeMatrixManifest(
        bundleRoot,
        buildMatrixManifest(document, { workspaceId, workspaceTitle }),
      );
      pathsWritten.push(MATRIX_SIDECAR);
    } catch (writeError: unknown) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      return failProjection(bundleRoot, pathsWritten, errors, {
        code: "write_failed",
        message,
        path: MATRIX_SIDECAR,
      });
    }
  }

  try {
    for (const indexPath of regenerateMatrixIndexes(bundleRoot, document)) {
      pathsWritten.push(normalizeBundleRelativePath(bundleRoot, indexPath));
    }
  } catch (writeError: unknown) {
    const message = writeError instanceof Error ? writeError.message : String(writeError);
    return failProjection(bundleRoot, pathsWritten, errors, {
      code: "write_failed",
      message,
    });
  }

  if (Array.isArray(historyEntries)) {
    try {
      pathsWritten.push(writeMatrixHistory(bundleRoot, historyEntries));
    } catch (writeError: unknown) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      return failProjection(bundleRoot, pathsWritten, errors, {
        code: "write_failed",
        message,
        path: `${HISTORY_DIR}/runs.json`,
      });
    }
  }

  return { pathsWritten, errors };
}
