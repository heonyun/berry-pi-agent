// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cellKey, createEmptyMatrixDocument } from "../shared/domain.ts";
import { createHistoryEntry } from "./matrix-history.ts";
import {
  exportMatrixBundle,
  matrixDocumentForWire,
  scheduleMatrixBundleExport,
} from "./export-matrix-bundle.ts";

describe("export-matrix-bundle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes matrix maps for wire transport", () => {
    const document = createEmptyMatrixDocument({ withResearchTemplate: false });
    const cells = new Map(document.sheet.cells);
    cells.set(cellKey(0, 0), { value: "A1", body: "body", frontmatter: "", provenance: "user" });
    const withCell = { ...document, sheet: { ...document.sheet, cells } };

    const wire = matrixDocumentForWire(withCell) as {
      sheet: { cells: Record<string, unknown> };
    };
    expect(wire.sheet.cells["0,0"]).toEqual({
      value: "A1",
      body: "body",
      frontmatter: "",
      provenance: "user",
    });
  });

  it("posts document and history to matrix bundle export", async () => {
    const document = createEmptyMatrixDocument({ withResearchTemplate: false });
    const history = [
      createHistoryEntry({
        intent: "test run",
        contextRanges: [],
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        targetRangeLabel: "A1",
        patchesApplied: 1,
      }),
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ workspaceId: "matrix-1", pathsWritten: ["history/runs.json"], errors: [] }), {
        status: 200,
      }),
    );

    const result = await exportMatrixBundle(document, history);

    expect(result.pathsWritten).toContain("history/runs.json");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/matrix-bundle/export",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ document: matrixDocumentForWire(document), history }),
      }),
    );
  });

  it("scheduleMatrixBundleExport warns on failure without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("export failed", { status: 500 }));

    scheduleMatrixBundleExport(createEmptyMatrixDocument(), []);

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Matrix bundle export failed"));
    });
  });
});
