import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cellKey, createEmptyMatrixDocument, MATRIX_SHEET_ID } from "../shared/domain.ts";
import { MATRIX_SIDECAR } from "../storage/matrix/sidecar.ts";
import { handleMatrixBundleExport, handleMatrixBundleLoad } from "./matrix-bundle.ts";
import { resolveContextCanvasServerConfig } from "./security.ts";

function sampleMatrixDocument() {
  const document = createEmptyMatrixDocument({ withResearchTemplate: true });
  const cells = new Map(document.sheet.cells);
  cells.set(cellKey(0, 0), {
    value: "hello",
    body: "Persisted body",
    frontmatter: "status: draft",
    provenance: "test",
  });
  return {
    ...document,
    sheet: { ...document.sheet, cells },
  };
}

describe("handleMatrixBundleExport", () => {
  it("writes markdown matrix bundle files for a document", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-matrix-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = sampleMatrixDocument();

    try {
      const result = handleMatrixBundleExport({ document }, config, tempRoot);
      expect(result.errors).toEqual([]);
      expect(result.pathsWritten.length).toBeGreaterThan(0);
      expect(readFileSync(path.join(result.bundleRoot, MATRIX_SIDECAR), "utf8")).toContain('"kind": "matrix-bundle"');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects workspace ids that escape the bundle root", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-matrix-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = sampleMatrixDocument();

    try {
      expect(() => handleMatrixBundleExport({ document, workspaceId: "../escape" }, config, tempRoot)).toThrow(
        /Invalid workspaceId/,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("handleMatrixBundleLoad", () => {
  it("round-trips through export and load handlers", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-matrix-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = sampleMatrixDocument();

    try {
      handleMatrixBundleExport({ document }, config, tempRoot);
      const loadResult = handleMatrixBundleLoad(config, tempRoot);
      expect(loadResult.statusCode).toBe(200);
      expect(loadResult.document).toEqual(document);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns 404 when bundle directory is missing", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-matrix-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });

    try {
      const loadResult = handleMatrixBundleLoad(config, tempRoot, "missing-workspace");
      expect(loadResult.statusCode).toBe(404);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
