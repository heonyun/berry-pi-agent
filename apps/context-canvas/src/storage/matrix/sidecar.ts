import fs from "node:fs";
import type { MatrixDocument } from "../../shared/domain.ts";
import { MATRIX_SIDECAR, matrixSidecarPath } from "./paths.ts";
import type { MatrixBundleManifest } from "./types.ts";

export function buildMatrixManifest(
  document: MatrixDocument,
  options: { workspaceId: string; workspaceTitle: string },
): MatrixBundleManifest {
  return {
    kind: "matrix-bundle",
    schemaVersion: 1,
    workspaceId: options.workspaceId,
    workspaceTitle: options.workspaceTitle,
    sheetId: document.sheet.id,
    sheetName: document.sheet.name,
    rows: document.sheet.rows,
    cols: document.sheet.cols,
    namedRanges: [...document.namedRanges.values()],
    templateId: document.templateId,
  };
}

export function readMatrixManifest(bundleRoot: string): MatrixBundleManifest | undefined {
  const sidecarPath = matrixSidecarPath(bundleRoot);
  if (!fs.existsSync(sidecarPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(sidecarPath, "utf8")) as MatrixBundleManifest;
    if (parsed?.kind !== "matrix-bundle" || parsed.schemaVersion !== 1 || !parsed.sheetId) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function writeMatrixManifest(bundleRoot: string, manifest: MatrixBundleManifest): void {
  fs.writeFileSync(matrixSidecarPath(bundleRoot), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export { MATRIX_SIDECAR };
