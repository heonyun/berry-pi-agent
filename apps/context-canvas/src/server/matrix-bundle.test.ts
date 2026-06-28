import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cellKey, createEmptyMatrixDocument, MATRIX_SHEET_ID, type MatrixHistoryEntry } from "../shared/domain.ts";
import { MATRIX_SIDECAR } from "../storage/matrix/sidecar.ts";
import { DEFAULT_MATRIX_WORKSPACE_ID } from "../storage/matrix/project.ts";
import { resolveWithinBundle } from "../storage/markdown/paths.ts";
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

function sampleHistoryEntry(): MatrixHistoryEntry {
  return {
    id: "hist-test-1",
    timestamp: "2026-06-28T12:00:00.000Z",
    intent: "Summarize inputs",
    contextRangeNames: ["@inputs"],
    contextRanges: [
      { label: "@inputs", range: { startRow: 0, startCol: 0, endRow: 4, endCol: 0 } },
    ],
    targetRangeLabel: "@outputs",
    targetRange: { startRow: 0, startCol: 4, endRow: 4, endCol: 4 },
    patchesApplied: 3,
    patchesSummary: "E1, E2, E3",
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
      expect(result.workspaceId).toBe(DEFAULT_MATRIX_WORKSPACE_ID);
      expect(result.pathsWritten.length).toBeGreaterThan(0);
      expect(result).not.toHaveProperty("bundleRoot");
      const bundleRoot = resolveWithinBundle(tempRoot, result.workspaceId);
      expect(readFileSync(path.join(bundleRoot, MATRIX_SIDECAR), "utf8")).toContain('"kind": "matrix-bundle"');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("writes history/runs.json when history is provided", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-matrix-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = sampleMatrixDocument();
    const history = [sampleHistoryEntry()];

    try {
      const result = handleMatrixBundleExport({ document, history }, config, tempRoot);
      expect(result.errors).toEqual([]);
      expect(result.pathsWritten).toContain("history/runs.json");
      const loadResult = handleMatrixBundleLoad(config, tempRoot);
      expect(loadResult.history).toHaveLength(1);
      expect(loadResult.history?.[0]?.intent).toBe("Summarize inputs");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("clears history/runs.json when an empty history array is exported", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-matrix-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = sampleMatrixDocument();
    const history = [sampleHistoryEntry()];

    try {
      handleMatrixBundleExport({ document, history }, config, tempRoot);
      expect(handleMatrixBundleLoad(config, tempRoot).history).toHaveLength(1);

      handleMatrixBundleExport({ document, history: [] }, config, tempRoot);
      expect(handleMatrixBundleLoad(config, tempRoot).history).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("accepts wire-format document with plain-object cells", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-matrix-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = sampleMatrixDocument();
    const wireDocument = {
      ...document,
      sheet: {
        ...document.sheet,
        cells: Object.fromEntries(document.sheet.cells),
      },
      namedRanges: Object.fromEntries(document.namedRanges),
    } as unknown as typeof document;

    try {
      const result = handleMatrixBundleExport({ document: wireDocument }, config, tempRoot);
      expect(result.errors).toEqual([]);
      expect(result.pathsWritten.length).toBeGreaterThan(0);
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
