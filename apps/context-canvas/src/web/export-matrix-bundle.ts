import { buildPromptRequestHeaders } from "./api.ts";
import type { MatrixDocument, MatrixHistoryEntry } from "../shared/domain.ts";

export type MatrixBundleExportResult = {
  workspaceId: string;
  pathsWritten: string[];
  errors: Array<{ path: string; message: string }>;
};

/** JSON-safe matrix document (Maps become plain objects for wire transport). */
export function matrixDocumentForWire(document: MatrixDocument): unknown {
  return {
    ...document,
    sheet: {
      ...document.sheet,
      cells: Object.fromEntries(document.sheet.cells),
    },
    namedRanges: Object.fromEntries(document.namedRanges),
  };
}

export async function exportMatrixBundle(
  document: MatrixDocument,
  history: readonly MatrixHistoryEntry[],
): Promise<MatrixBundleExportResult> {
  const response = await fetch("/api/matrix-bundle/export", {
    method: "POST",
    headers: buildPromptRequestHeaders(import.meta.env.VITE_CONTEXT_CANVAS_TOKEN),
    body: JSON.stringify({ document: matrixDocumentForWire(document), history }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Matrix bundle export failed (${response.status})`);
  }

  return (await response.json()) as MatrixBundleExportResult;
}

/** Fire-and-forget bundle export after a successful matrix run. */
export function scheduleMatrixBundleExport(
  document: MatrixDocument,
  history: readonly MatrixHistoryEntry[],
): void {
  void exportMatrixBundle(document, history).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Matrix bundle export failed: ${message}`);
  });
}
