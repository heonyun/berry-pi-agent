import { buildPromptRequestHeaders } from "./api.ts";
import type { ContextCanvasDocument } from "../shared/domain.ts";

export type BundleLoadResult = {
  document?: ContextCanvasDocument;
  warnings: string[];
  errors: string[];
};

function formatErrorBody(text: string): string {
  try {
    const payload = JSON.parse(text) as { error?: unknown; errors?: unknown };
    if (Array.isArray(payload.errors)) {
      return payload.errors.map(String).join(" ");
    }
    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // Fall through to the raw response text.
  }
  return text;
}

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
    throw new Error(text ? formatErrorBody(text) : `Bundle load failed (${response.status})`);
  }

  return (await response.json()) as BundleLoadResult;
}
