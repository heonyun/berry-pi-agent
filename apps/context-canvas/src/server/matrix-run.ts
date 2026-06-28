import type { ServerResponse } from "node:http";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { CompiledRangeContext } from "../shared/compile-matrix-range-context.ts";
import type { AiCommand, RangeRefDTO } from "../shared/domain.ts";
import { parseAiCommand } from "../shared/matrix-validation.ts";
import { assistantMessageText, assistantRunErrorMessage } from "./assistant-message.ts";

export interface MatrixRunRequestBody {
  readonly prompt: string;
  readonly targetRange: RangeRefDTO;
  readonly compiled: CompiledRangeContext;
}

export interface MatrixRunResponseBody {
  readonly command: AiCommand;
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error("No JSON object found in model response.");
}

function formatCompiledPrompt(compiled: CompiledRangeContext, prompt: string): string {
  const userMessage = compiled.messages.find((message) => message.role === "user")?.content;
  return [userMessage ?? `User intent: ${prompt}`, "", "Respond with the AiCommand JSON object only."].join("\n");
}

export async function handleMatrixRun(
  body: MatrixRunRequestBody,
  res: ServerResponse,
  getSession: () => Promise<AgentSession>,
): Promise<void> {
  if (!body.prompt?.trim()) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "prompt is required." }));
    return;
  }
  if (!body.targetRange || !body.compiled) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "targetRange and compiled are required." }));
    return;
  }

  try {
    const session = await getSession();
    const promptText = formatCompiledPrompt(body.compiled, body.prompt);
    await session.prompt(promptText);

    const messages = session.messages;
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) {
      throw new Error("Model did not return an assistant message.");
    }

    const runError = assistantRunErrorMessage(lastAssistant);
    if (runError) {
      throw new Error(runError);
    }

    const rawText = assistantMessageText(lastAssistant);
    const parsed = parseAiCommand(extractJsonObject(rawText));
    if (!parsed.ok) {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: parsed.errors.message }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ command: parsed.command } satisfies MatrixRunResponseBody));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
}
