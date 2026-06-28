import { buildPromptRequestHeaders } from "./api.ts";
import type { CompiledRangeContext } from "../shared/compile-matrix-range-context.ts";
import type { AiCommand, RangeRefDTO } from "../shared/domain.ts";

export interface MatrixRunClientRequest {
  readonly prompt: string;
  readonly targetRange: RangeRefDTO;
  readonly compiled: CompiledRangeContext;
}

export interface MatrixRunClientResponse {
  readonly command: AiCommand;
}

export async function runMatrix(request: MatrixRunClientRequest): Promise<MatrixRunClientResponse> {
  const response = await fetch("/api/matrix-run", {
    method: "POST",
    headers: buildPromptRequestHeaders(import.meta.env.VITE_CONTEXT_CANVAS_TOKEN),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return (await response.json()) as MatrixRunClientResponse;
}
