export type ContextCanvasServerConfig = {
  allowedOrigins: string[];
  bindHost: string;
  enableMutationTools: boolean;
  model: string;
  port: number;
  provider: string;
  requireToken: boolean;
  token?: string;
};

type Env = Partial<Record<string, string>>;

export type RequestAccessInput = {
  method?: string;
  origin?: string;
  token?: string;
  url?: string;
};

export type RequestAccessResult =
  | { ok: true }
  | { ok: false; message: string; statusCode: 403 };

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function splitCsv(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

export function resolveContextCanvasServerConfig(env: Env): ContextCanvasServerConfig {
  return {
    allowedOrigins: splitCsv(env.CONTEXT_CANVAS_ALLOWED_ORIGINS).length
      ? splitCsv(env.CONTEXT_CANVAS_ALLOWED_ORIGINS)
      : DEFAULT_ALLOWED_ORIGINS,
    bindHost: env.CONTEXT_CANVAS_BIND_HOST?.trim() || "127.0.0.1",
    enableMutationTools: env.CONTEXT_CANVAS_ENABLE_MUTATION_TOOLS === "1",
    model: env.CONTEXT_CANVAS_MODEL?.trim() || "gpt-5.4-mini",
    port: Number(env.CONTEXT_CANVAS_PORT || 3001),
    provider: env.CONTEXT_CANVAS_PROVIDER?.trim() || "openai-codex",
    requireToken: env.CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED !== "1",
    token: env.CONTEXT_CANVAS_TOKEN?.trim() || undefined,
  };
}

export function resolveAgentTools(config: ContextCanvasServerConfig): string[] {
  return config.enableMutationTools ? ["read", "bash", "edit", "write"] : ["read"];
}

export function isAllowedOrigin(origin: string | undefined, config: ContextCanvasServerConfig): boolean {
  return origin === undefined || config.allowedOrigins.includes(origin);
}

export function buildCorsHeaders(
  origin: string | undefined,
  config: ContextCanvasServerConfig,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type, X-Context-Canvas-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin, config)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function verifyRequestAccess(
  request: RequestAccessInput,
  config: ContextCanvasServerConfig,
): RequestAccessResult {
  if (request.url !== "/api/prompt" || request.method === "OPTIONS") {
    return { ok: true };
  }
  if (!isAllowedOrigin(request.origin, config)) {
    return { ok: false, statusCode: 403, message: "Origin is not allowed." };
  }
  if (!config.requireToken) {
    return { ok: true };
  }
  if (!config.token) {
    return { ok: false, statusCode: 403, message: "Context canvas token is not configured." };
  }
  if (request.token !== config.token) {
    return { ok: false, statusCode: 403, message: "Invalid context canvas token." };
  }
  return { ok: true };
}
