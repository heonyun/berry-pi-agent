import { buildPromptRequestHeaders } from "../web/api.ts";
import type { ContextCanvasDocument } from "../shared/domain.ts";

export async function streamPrompt(
  document: ContextCanvasDocument,
  promptNodeId: string,
  onDelta: (delta: string) => void,
): Promise<void> {
  const response = await fetch("/api/prompt", {
    method: "POST",
    headers: buildPromptRequestHeaders(import.meta.env.VITE_CONTEXT_CANVAS_TOKEN),
    body: JSON.stringify({ document, promptNodeId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((entry) => entry.startsWith("data: "));
      if (!line) {
        continue;
      }
      const payload = JSON.parse(line.slice(6)) as
        | { type: "text_delta"; delta: string }
        | { type: "error"; message: string }
        | { type: "done" }
        | { type: "tool_start" }
        | { type: "tool_end" };
      if (payload.type === "text_delta") {
        onDelta(payload.delta);
      } else if (payload.type === "error") {
        throw new Error(payload.message);
      }
    }
  }
}
