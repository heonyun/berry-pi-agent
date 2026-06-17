import { describe, expect, it } from "vitest";
import {
  buildCorsHeaders,
  resolveAgentTools,
  resolveContextCanvasServerConfig,
  verifyRequestAccess,
} from "./security.ts";

describe("context canvas server security", () => {
  it("defaults to localhost bind, read-only tools, and configured model fallback", () => {
    const config = resolveContextCanvasServerConfig({});

    expect(config.bindHost).toBe("127.0.0.1");
    expect(config.provider).toBe("openai-codex");
    expect(config.model).toBe("gpt-5.4-mini");
    expect(resolveAgentTools(config)).toEqual(["read"]);
  });

  it("requires opt-in before enabling mutation-capable agent tools", () => {
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ENABLE_MUTATION_TOOLS: "1",
    });

    expect(resolveAgentTools(config)).toEqual(["read", "bash", "edit", "write"]);
  });

  it("reflects only allowlisted CORS origins", () => {
    const config = resolveContextCanvasServerConfig({});

    expect(buildCorsHeaders("http://localhost:5173", config)).toMatchObject({
      "Access-Control-Allow-Origin": "http://localhost:5173",
      Vary: "Origin",
    });
    expect(buildCorsHeaders("https://evil.example", config)).not.toHaveProperty(
      "Access-Control-Allow-Origin",
    );
  });

  it("blocks prompt requests from non-allowlisted origins", () => {
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_TOKEN: "dev-secret",
    });

    expect(
      verifyRequestAccess(
        { method: "POST", url: "/api/prompt", origin: "https://evil.example", token: "dev-secret" },
        config,
      ),
    ).toEqual({ ok: false, statusCode: 403, message: "Origin is not allowed." });
  });

  it("blocks prompt requests without the configured dev token", () => {
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_TOKEN: "dev-secret",
    });

    expect(
      verifyRequestAccess(
        { method: "POST", url: "/api/prompt", origin: "http://localhost:5173" },
        config,
      ),
    ).toEqual({ ok: false, statusCode: 403, message: "Invalid context canvas token." });
  });

  it("allows prompt requests from allowlisted origins with the configured dev token", () => {
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_TOKEN: "dev-secret",
    });

    expect(
      verifyRequestAccess(
        { method: "POST", url: "/api/prompt", origin: "http://localhost:5173", token: "dev-secret" },
        config,
      ),
    ).toEqual({ ok: true });
  });

  it("blocks bundle export requests from non-allowlisted origins", () => {
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_TOKEN: "dev-secret",
    });

    expect(
      verifyRequestAccess(
        {
          method: "POST",
          url: "/api/bundle/export",
          origin: "https://evil.example",
          token: "dev-secret",
        },
        config,
      ),
    ).toEqual({ ok: false, statusCode: 403, message: "Origin is not allowed." });
  });
});
