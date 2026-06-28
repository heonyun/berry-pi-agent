import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { getModel, type KnownProvider } from "@earendil-works/pi-ai";
import { createAgentSession, SessionManager, type AgentSession } from "@earendil-works/pi-coding-agent";
import { compilePromptContext, formatPromptForPi, type CompiledPromptContext } from "../shared/compiler.ts";
import { compileQABlockContext } from "../shared/compile-qablock-context.ts";
import type { ContextCanvasDocument, MatrixDocument, MatrixHistoryEntry, QABlockCanvasDocument } from "../shared/domain.ts";
import { DEFAULT_CANVAS_ID, createInitialDocument } from "../shared/domain.ts";
import { loadBundleToDocument } from "../storage/markdown/load.ts";
import { projectDocumentToBundle } from "../storage/markdown/project.ts";
import { assertSafeId, resolveWithinBundle } from "../storage/markdown/paths.ts";
import {
  assistantMessageText,
  assistantRunErrorMessage,
  findAssistantRunError,
} from "./assistant-message.ts";
import {
  buildCorsHeaders,
  resolveAgentTools,
  resolveContextCanvasServerConfig,
  verifyRequestAccess,
  type ContextCanvasServerConfig,
} from "./security.ts";
import { handleMatrixRun, type MatrixRunRequestBody } from "./matrix-run.ts";
import { handleMatrixBundleExport, handleMatrixBundleLoad } from "./matrix-bundle.ts";

export { assistantMessageText, assistantRunErrorMessage, findAssistantRunError } from "./assistant-message.ts";

const MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024;
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const serverConfig = resolveContextCanvasServerConfig(process.env);

function resolveBundleRootBase(config: ContextCanvasServerConfig): string {
  if (config.bundleRootBase) {
    return path.resolve(config.bundleRootBase);
  }
  return path.join(monorepoRoot, ".context-bundles");
}

type SseEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_start"; toolCallId: string; toolName: string }
  | { type: "tool_end"; toolCallId: string; toolName: string; isError: boolean }
  | { type: "error"; message: string }
  | { type: "done" };

let sessionPromise: Promise<AgentSession> | undefined;

class RequestBodyTooLargeError extends Error {
  constructor() {
    super(`Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`);
    this.name = "RequestBodyTooLargeError";
  }
}

async function getSession(): Promise<AgentSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const model = getModel(serverConfig.provider as KnownProvider, serverConfig.model as never);
        if (!model) {
          throw new Error(`Model ${serverConfig.provider}/${serverConfig.model} is not available.`);
        }
        const { session } = await createAgentSession({
          cwd: monorepoRoot,
          model,
          tools: resolveAgentTools(serverConfig),
          sessionManager: SessionManager.inMemory(monorepoRoot),
        });
        return session;
      } catch (error) {
        sessionPromise = undefined;
        throw error;
      }
    })();
  }
  return sessionPromise;
}

function requestOrigin(req: IncomingMessage): string | undefined {
  const origin = req.headers.origin;
  return Array.isArray(origin) ? origin[0] : origin;
}

function requestToken(req: IncomingMessage): string | undefined {
  const token = req.headers["x-context-canvas-token"];
  return Array.isArray(token) ? token[0] : token;
}

function setCors(res: ServerResponse, origin: string | undefined, config = serverConfig): void {
  for (const [key, value] of Object.entries(buildCorsHeaders(origin, config))) {
    res.setHeader(key, value);
  }
}

function writeSse(res: ServerResponse, event: SseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let totalLength = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalLength += buffer.length;
    if (totalLength > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as T;
}

export function handleBundleExport(
  body: { document: ContextCanvasDocument; promptNodeId?: string },
  config: ContextCanvasServerConfig,
): { bundleRoot: string; pathsWritten: string[]; errors: Array<{ path: string; message: string }> } {
  assertSafeId(body.document.canvas.id, "canvasId");
  const bundleRoot = resolveWithinBundle(resolveBundleRootBase(config), body.document.canvas.id);
  const compiledByPromptId = new Map<string, CompiledPromptContext>();
  if (body.promptNodeId) {
    compiledByPromptId.set(body.promptNodeId, compilePromptContext(body.document, body.promptNodeId));
  }
  const result = projectDocumentToBundle(body.document, bundleRoot, {
    includeCompiled: compiledByPromptId.size > 0,
    compiledByPromptId,
  });
  return {
    bundleRoot,
    pathsWritten: result.pathsWritten,
    errors: result.errors.map((error) => ({
      path: error.path ?? "",
      message: error.message,
    })),
  };
}

export function handleBundleLoad(config: ContextCanvasServerConfig): {
  document?: ContextCanvasDocument;
  warnings: string[];
  errors: string[];
  statusCode: 200 | 404 | 422 | 500;
} {
  const canvasId = DEFAULT_CANVAS_ID;
  assertSafeId(canvasId, "canvasId");
  const bundleRoot = resolveWithinBundle(resolveBundleRootBase(config), canvasId);
  const bundleExists = fs.existsSync(bundleRoot);
  try {
    const result = loadBundleToDocument(bundleRoot);
    if (result.document) {
      if (result.document.canvas.id !== canvasId) {
        return {
          warnings: result.warnings,
          errors: [`Bundle canvas id mismatch: expected ${canvasId}, loaded ${result.document.canvas.id}.`],
          statusCode: 422,
        };
      }
      return { ...result, statusCode: 200 };
    }
    return { ...result, statusCode: bundleExists ? 422 : 404 };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { warnings: [], errors: [message], statusCode: 500 };
  }
}

async function handleCompiledPrompt(
  compiled: CompiledPromptContext,
  res: ServerResponse,
): Promise<void> {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let unsubscribe: (() => void) | undefined;
  try {
    const promptText = formatPromptForPi(compiled);
    const session = await getSession();
    let streamedText = "";
    let promptErrorSent = false;

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

      unsubscribe = session.subscribe((event: Parameters<Parameters<AgentSession["subscribe"]>[0]>[0]) => {
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          streamedText += event.assistantMessageEvent.delta;
          writeSse(res, { type: "text_delta", delta: event.assistantMessageEvent.delta });
        } else if (event.type === "message_end" && event.message.role === "assistant") {
          const runError = assistantRunErrorMessage(event.message);
          if (runError) {
            writeSse(res, { type: "error", message: runError });
            promptErrorSent = true;
            return;
          }
          const finalText = assistantMessageText(event.message);
          if (finalText.length > streamedText.length && finalText.startsWith(streamedText)) {
            writeSse(res, { type: "text_delta", delta: finalText.slice(streamedText.length) });
            streamedText = finalText;
          } else if (!streamedText && finalText) {
            writeSse(res, { type: "text_delta", delta: finalText });
            streamedText = finalText;
          }
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
          if (!promptErrorSent && !streamedText) {
            const runError = findAssistantRunError(event.messages);
            if (runError) {
              writeSse(res, { type: "error", message: runError });
              promptErrorSent = true;
            }
          }
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

async function handlePrompt(
  body: { document: ContextCanvasDocument; promptNodeId: string },
  res: ServerResponse,
): Promise<void> {
  const compiled = compilePromptContext(body.document, body.promptNodeId);
  await handleCompiledPrompt(compiled, res);
}

async function handleQABlockPrompt(
  body: { document: QABlockCanvasDocument; blockId: string },
  res: ServerResponse,
): Promise<void> {
  const compiled = compileQABlockContext(body.document, body.blockId);
  await handleCompiledPrompt(compiled, res);
}

function isQABlockPromptBody(
  body: { document: ContextCanvasDocument | QABlockCanvasDocument; promptNodeId?: string; blockId?: string },
): body is { document: QABlockCanvasDocument; blockId: string } {
  return body.document.schemaVersion === 2 && typeof body.blockId === "string";
}

export function createContextCanvasServer(config: ContextCanvasServerConfig = serverConfig) {
  return createServer(async (req, res) => {
    const origin = requestOrigin(req);
    setCors(res, origin, config);

    const access = verifyRequestAccess(
      { method: req.method, origin, token: requestToken(req), url: req.url },
      config,
    );
    if (!access.ok) {
      res.writeHead(access.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: access.message }));
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && req.url === "/api/bundle/load") {
      const routeAccess = verifyRequestAccess(
        { method: req.method, origin, token: requestToken(req), url: req.url },
        config,
      );
      if (!routeAccess.ok) {
        res.writeHead(routeAccess.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: routeAccess.message }));
        return;
      }
      const result = handleBundleLoad(config);
      res.writeHead(result.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.method === "POST" && req.url === "/api/prompt") {
      try {
        const body = await readJsonBody<{
          document: ContextCanvasDocument | QABlockCanvasDocument;
          promptNodeId?: string;
          blockId?: string;
        }>(req);
        if (isQABlockPromptBody(body)) {
          await handleQABlockPrompt(body, res);
        } else if (typeof body.promptNodeId === "string") {
          await handlePrompt(
            { document: body.document as ContextCanvasDocument, promptNodeId: body.promptNodeId },
            res,
          );
        } else {
          throw new Error("Invalid prompt request body.");
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = error instanceof RequestBodyTooLargeError ? 413 : 400;
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/api/matrix-run") {
      try {
        const body = await readJsonBody<MatrixRunRequestBody>(req);
        await handleMatrixRun(body, res, getSession);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = error instanceof RequestBodyTooLargeError ? 413 : 400;
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    if (req.method === "GET" && req.url === "/api/matrix-bundle/load") {
      const result = handleMatrixBundleLoad(config, monorepoRoot);
      res.writeHead(result.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.method === "POST" && req.url === "/api/matrix-bundle/export") {
      try {
        const body = await readJsonBody<{
          document: MatrixDocument;
          workspaceId?: string;
          workspaceTitle?: string;
          history?: MatrixHistoryEntry[];
        }>(req);
        const result = handleMatrixBundleExport(body, config, monorepoRoot);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = error instanceof RequestBodyTooLargeError ? 413 : 400;
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/api/bundle/export") {
      try {
        const body = await readJsonBody<{ document: ContextCanvasDocument; promptNodeId?: string }>(req);
        const result = handleBundleExport(body, config);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = error instanceof RequestBodyTooLargeError ? 413 : 400;
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });
}

export function startContextCanvasServer(config: ContextCanvasServerConfig = serverConfig): void {
  const server = createContextCanvasServer(config);
  server.listen(config.port, config.bindHost, () => {
    const address = server.address() as AddressInfo;
    console.log(`Context Canvas API listening on http://${config.bindHost}:${address.port}`);
    console.log(`Agent cwd: ${monorepoRoot}`);
    console.log(`Agent tools: ${resolveAgentTools(config).join(", ")}`);
    console.log(`Agent model: ${config.provider}/${config.model}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startContextCanvasServer();
}
