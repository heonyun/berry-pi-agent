import { buildPromptRequestHeaders } from "./api.ts";
import type { ContextCanvasDocument } from "../shared/domain.ts";

export type BundleExportResult = {
  bundleRoot: string;
  pathsWritten: string[];
  errors: Array<{ path: string; message: string }>;
};

export async function exportBundle(
  document: ContextCanvasDocument,
  promptNodeId?: string,
): Promise<BundleExportResult> {
  const response = await fetch("/api/bundle/export", {
    method: "POST",
    headers: buildPromptRequestHeaders(import.meta.env.VITE_CONTEXT_CANVAS_TOKEN),
    body: JSON.stringify({ document, promptNodeId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Bundle export failed (${response.status})`);
  }

  return (await response.json()) as BundleExportResult;
}
