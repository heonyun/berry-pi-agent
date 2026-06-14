import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getModel } from "@earendil-works/pi-ai";
import { createAgentSession, SessionManager, type AgentSession } from "@earendil-works/pi-coding-agent";
import { compilePromptContext, formatPromptForPi } from "../shared/compiler.ts";
import type { ContextCanvasDocument } from "../shared/domain.ts";

const PORT = 3001;
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

type SseEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_start"; toolCallId: string; toolName: string }
  | { type: "tool_end"; toolCallId: string; toolName: string; isError: boolean }
  | { type: "error"; message: string }
  | { type: "done" };

let sessionPromise: Promise<AgentSession> | undefined;

async function getSession(): Promise<AgentSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const model = getModel("openai-codex", "gpt-5.4-mini");
      if (!model) {
        throw new Error("Model openai-codex/gpt-5.4-mini is not available.");
      }
      const { session } = await createAgentSession({
        cwd: monorepoRoot,
        model,
        tools: ["read", "bash", "edit", "write"],
        sessionManager: SessionManager.inMemory(monorepoRoot),
      });
      return session;
    })();
  }
  return sessionPromise;
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function writeSse(res: ServerResponse, event: SseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as T;
}

async function handlePrompt(
  body: { document: ContextCanvasDocument; promptNodeId: string },
  res: ServerResponse,
): Promise<void> {
  setCors(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let unsubscribe: (() => void) | undefined;
  try {
    const compiled = compilePromptContext(body.document, body.promptNodeId);
    const promptText = formatPromptForPi(compiled);
    const session = await getSession();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        unsubscribe?.();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      unsubscribe = session.subscribe((event) => {
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          writeSse(res, { type: "text_delta", delta: event.assistantMessageEvent.delta });
        } else if (event.type === "tool_execution_start") {
          writeSse(res, {
            type: "tool_start",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
          });
        } else if (event.type === "tool_execution_end") {
          writeSse(res, {
            type: "tool_end",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            isError: event.isError,
          });
        } else if (event.type === "agent_end") {
          writeSse(res, { type: "done" });
          finish();
        }
      });

      void session.prompt(promptText).catch((error: unknown) => {
        finish(error);
      });
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    writeSse(res, { type: "error", message });
    writeSse(res, { type: "done" });
  } finally {
    unsubscribe?.();
    res.end();
  }
}

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, cwd: monorepoRoot }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/prompt") {
    try {
      const body = await readJsonBody<{ document: ContextCanvasDocument; promptNodeId: string }>(req);
      await handlePrompt(body, res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Context Canvas API listening on http://127.0.0.1:${PORT}`);
  console.log(`Agent cwd: ${monorepoRoot}`);
});