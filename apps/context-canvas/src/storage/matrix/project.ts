import fs from "node:fs";
import path from "node:path";
import type { MatrixDocument } from "../../shared/domain.ts";
import { serialize } from "../markdown/document.ts";
import { assertSafeId } from "../markdown/paths.ts";
import { regenerateMatrixIndexes } from "./index.ts";
import {
  CELLS_DIR,
  cellCoordToPath,
  normalizeBundleRelativePath,
  templatePath,
  TEMPLATES_DIR,
} from "./paths.ts";
import { buildMatrixManifest, writeMatrixManifest } from "./sidecar.ts";
import { MATRIX_SIDECAR } from "./sidecar.ts";
import type { MatrixCellProjectionFrontmatter, ProjectOptions, ProjectResult } from "./types.ts";

export const DEFAULT_MATRIX_WORKSPACE_ID = "matrix-1";

export function projectMatrixToBundle(
  document: MatrixDocument,
  bundleRoot: string,
  options: ProjectOptions = {},
): ProjectResult {
  const {
    workspaceId = DEFAULT_MATRIX_WORKSPACE_ID,
    workspaceTitle = document.sheet.name,
    writeMatrixSidecar = true,
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

    fs.writeFileSync(cellPath, serialize({ frontmatter, body: cell.body }), "utf8");
    pathsWritten.push(normalizeBundleRelativePath(bundleRoot, cellPath));
  }

  if (document.template) {
    fs.mkdirSync(path.join(bundleRoot, TEMPLATES_DIR), { recursive: true });
    const templateFile = templatePath(bundleRoot, document.template.id);
    fs.writeFileSync(templateFile, `${JSON.stringify(document.template, null, 2)}\n`, "utf8");
    pathsWritten.push(normalizeBundleRelativePath(bundleRoot, templateFile));
  }

  if (writeMatrixSidecar) {
    writeMatrixManifest(
      bundleRoot,
      buildMatrixManifest(document, { workspaceId, workspaceTitle }),
    );
    pathsWritten.push(MATRIX_SIDECAR);
  }

  for (const indexPath of regenerateMatrixIndexes(bundleRoot, document)) {
    pathsWritten.push(normalizeBundleRelativePath(bundleRoot, indexPath));
  }

  return { pathsWritten, errors };
}
