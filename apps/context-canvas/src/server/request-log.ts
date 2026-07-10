import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";

export interface RequestLogContext {
  readonly reqId: string;
  readonly method: string;
  readonly path: string;
  readonly startedAtMs: number;
  readonly extra?: Record<string, string | number | boolean | undefined>;
}

export function shouldLogContextCanvasRequests(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.CONTEXT_CANVAS_REQUEST_LOG?.trim();
  if (flag === "0") {
    return false;
  }
  if (flag === "1") {
    return true;
  }
  return env.NODE_ENV !== "production";
}

export function createRequestLogId(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function normalizeRequestPath(url: string | undefined): string {
  if (!url) {
    return "/";
  }
  return url.split("?")[0] ?? url;
}

export function formatRequestLogLine(
  context: RequestLogContext,
  statusCode: number,
  endedAtMs: number = Date.now(),
): string {
  const durationMs = Math.max(0, endedAtMs - context.startedAtMs);
  const extraParts: string[] = [];
  if (context.extra) {
    for (const [key, value] of Object.entries(context.extra)) {
      if (value !== undefined) {
        extraParts.push(`${key}=${value}`);
      }
    }
  }
  const extra = extraParts.length > 0 ? ` ${extraParts.join(" ")}` : "";
  return `[context-canvas] reqId=${context.reqId} ${context.method} ${context.path} ${statusCode} ${durationMs}ms${extra}`;
}

export function logContextCanvasRequest(
  context: RequestLogContext,
  statusCode: number,
  endedAtMs: number = Date.now(),
): void {
  if (!shouldLogContextCanvasRequests()) {
    return;
  }
  console.log(formatRequestLogLine(context, statusCode, endedAtMs));
}

export function instrumentResponseForRequestLogging(
  req: IncomingMessage,
  res: ServerResponse,
): RequestLogContext | undefined {
  if (!shouldLogContextCanvasRequests()) {
    return undefined;
  }
  const context: RequestLogContext = {
    reqId: createRequestLogId(),
    method: req.method ?? "GET",
    path: normalizeRequestPath(req.url),
    startedAtMs: Date.now(),
    extra: {},
  };
  let statusCode = 200;
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = ((code: number | string, ...args: unknown[]) => {
    statusCode = typeof code === "number" ? code : Number(code);
    return originalWriteHead(code as never, ...(args as never[]));
  }) as typeof res.writeHead;
  const originalEnd = res.end.bind(res);
  res.end = ((...args: unknown[]) => {
    logContextCanvasRequest(context, statusCode);
    return originalEnd(...(args as Parameters<typeof res.end>));
  }) as typeof res.end;
  return context;
}
