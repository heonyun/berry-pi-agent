import { buildPromptRequestHeaders } from "./api.ts";
import type { ContextCanvasDocument } from "../shared/domain.ts";

export type BundleLoadResult = {
  document?: ContextCanvasDocument;
  warnings: string[];
  errors: string[];
};

export async function loadBundle(): Promise<BundleLoadResult> {
  const response = await fetch("/api/bundle/load", {
    method: "GET",
    headers: buildPromptRequestHeaders(import.meta.env.VITE_CONTEXT_CANVAS_TOKEN),
  });

  if (response.status === 404) {
    return { warnings: [], errors: ["No saved bundle found."] };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Bundle load failed (${response.status})`);
  }

  return (await response.json()) as BundleLoadResult;
}
