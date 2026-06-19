import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInitialDocument } from "../shared/domain.ts";
import { CANVAS_SIDECAR } from "../storage/markdown/sidecar.ts";
import { assistantMessageText, findAssistantRunError, assistantRunErrorMessage, createContextCanvasServer, handleBundleExport, handleBundleLoad } from "./index.ts";
import { resolveContextCanvasServerConfig } from "./security.ts";

describe("handleBundleExport", () => {
  it("writes markdown bundle files for a document", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = createInitialDocument();

    try {
      const result = handleBundleExport({ document }, config);
      expect(result.errors).toEqual([]);
      expect(result.pathsWritten.length).toBeGreaterThan(0);
      expect(readFileSync(path.join(result.bundleRoot, CANVAS_SIDECAR), "utf8")).toContain('"canvas"');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects canvas ids that escape the bundle root", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = {
      ...createInitialDocument(),
      canvas: { ...createInitialDocument().canvas, id: "../escape" },
    };

    try {
      expect(() => handleBundleExport({ document }, config)).toThrow(/Invalid canvasId/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects a saved snapshot whose canvas id does not match the loaded bundle path", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
    });
    const document = createInitialDocument();

    try {
      const exportResult = handleBundleExport({ document }, config);
      const sidecarPath = path.join(exportResult.bundleRoot, CANVAS_SIDECAR);
      const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")) as typeof document;
      writeFileSync(sidecarPath, JSON.stringify({ ...sidecar, canvas: { ...sidecar.canvas, id: "canvas-2" } }));

      const loadResult = handleBundleLoad(config);

      expect(loadResult.statusCode).toBe(422);
      expect(loadResult.errors).toEqual(["Bundle canvas id mismatch: expected canvas-1, loaded canvas-2."]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("assistantMessageText", () => {
  it("extracts final assistant text for streams that do not emit text deltas", () => {
    expect(
      assistantMessageText({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "internal" },
          { type: "text", text: "Hello" },
          { type: "text", text: " world." },
        ],
        api: "openai-codex-responses",
        provider: "openai-codex",
        model: "gpt-5.4-mini",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      }),
    ).toBe("Hello world.");
  });
});

describe("assistantRunErrorMessage", () => {
  it("returns explicit provider auth errors", () => {
    expect(
      assistantRunErrorMessage({
        role: "assistant",
        content: [],
        api: "openai-codex-responses",
        provider: "openai-codex",
        model: "gpt-5.4-mini",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "error",
        errorMessage: "Your authentication token has been invalidated. Please try signing in again.",
        timestamp: Date.now(),
      }),
    ).toBe("Your authentication token has been invalidated. Please try signing in again.");
  });

  it("returns a fallback message when stopReason is error without errorMessage", () => {
    expect(
      assistantRunErrorMessage({
        role: "assistant",
        content: [],
        api: "openai-codex-responses",
        provider: "openai-codex",
        model: "gpt-5.4-mini",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "error",
        timestamp: Date.now(),
      }),
    ).toBe("Agent run failed before producing an answer.");
  });
});

describe("findAssistantRunError", () => {
  it("finds the latest assistant failure from agent_end messages", () => {
    expect(
      findAssistantRunError([
        {
          role: "assistant",
          stopReason: "error",
          errorMessage: "Provider quota exceeded.",
        },
      ]),
    ).toBe("Provider quota exceeded.");
  });
});

describe("POST /api/bundle/export", () => {
  let tempRoot = "";
  let server: ReturnType<typeof createContextCanvasServer>;
  let port = 0;

  beforeAll(async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-api-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: tempRoot,
      CONTEXT_CANVAS_PORT: "0",
    });
    server = createContextCanvasServer({ ...config, port: 0 });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve test server port.");
    }
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("returns bundle export metadata", async () => {
    const document = createInitialDocument();
    const response = await fetch(`http://127.0.0.1:${port}/api/bundle/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { pathsWritten: string[]; bundleRoot: string };
    expect(payload.pathsWritten.length).toBeGreaterThan(0);
    expect(payload.bundleRoot).toContain(document.canvas.id);
  });

  it("loads the saved bundle snapshot", async () => {
    const document = {
      ...createInitialDocument(),
      nodes: [
        {
          ...createInitialDocument().nodes[0]!,
          text: "saved prompt from disk",
        },
      ],
    };
    const exportResponse = await fetch(`http://127.0.0.1:${port}/api/bundle/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document }),
    });
    expect(exportResponse.status).toBe(200);

    const response = await fetch(`http://127.0.0.1:${port}/api/bundle/load`);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { document: typeof document; warnings: string[] };
    expect(payload.document.nodes).toHaveLength(1);
    expect(payload.document.nodes[0]?.text).toBe("saved prompt from disk");
    expect(payload.warnings).toEqual(expect.any(Array));
  });

  it("loads a saved bundle after a server restart with the same bundle root", async () => {
    const restartRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-restart-api-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: restartRoot,
      CONTEXT_CANVAS_PORT: "0",
    });
    const document = {
      ...createInitialDocument(),
      nodes: [
        {
          ...createInitialDocument().nodes[0]!,
          text: "saved before restart",
        },
      ],
    };
    let restartedServer: ReturnType<typeof createContextCanvasServer> | undefined;

    try {
      handleBundleExport({ document }, config);
      restartedServer = createContextCanvasServer({ ...config, port: 0 });
      await new Promise<void>((resolve) => {
        restartedServer!.listen(0, "127.0.0.1", () => resolve());
      });
      const address = restartedServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to resolve test server port.");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/api/bundle/load`);

      expect(response.status).toBe(200);
      const payload = (await response.json()) as { document: typeof document };
      expect(payload.document.canvas.id).toBe("canvas-1");
      expect(payload.document.nodes[0]?.text).toBe("saved before restart");
    } finally {
      if (restartedServer) {
        await new Promise<void>((resolve, reject) => {
          restartedServer!.close((error) => (error ? reject(error) : resolve()));
        });
      }
      rmSync(restartRoot, { recursive: true, force: true });
    }
  });

  it("returns 404 when no saved bundle exists", async () => {
    const emptyRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-empty-api-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: emptyRoot,
      CONTEXT_CANVAS_PORT: "0",
    });
    const emptyServer = createContextCanvasServer({ ...config, port: 0 });

    try {
      await new Promise<void>((resolve) => {
        emptyServer.listen(0, "127.0.0.1", () => resolve());
      });
      const address = emptyServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to resolve test server port.");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/api/bundle/load`);

      expect(response.status).toBe(404);
      const payload = (await response.json()) as { errors: string[] };
      expect(payload.errors.some((error) => error.includes("Bundle directory not found"))).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        emptyServer.close((error) => (error ? reject(error) : resolve()));
      });
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it("returns 422 when a bundle directory exists but cannot be loaded", async () => {
    const corruptRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-corrupt-api-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_ALLOW_UNAUTHENTICATED: "1",
      CONTEXT_CANVAS_BUNDLE_ROOT: corruptRoot,
      CONTEXT_CANVAS_PORT: "0",
    });
    const corruptServer = createContextCanvasServer({ ...config, port: 0 });

    try {
      await new Promise<void>((resolve) => {
        corruptServer.listen(0, "127.0.0.1", () => resolve());
      });
      const address = corruptServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to resolve test server port.");
      }

      handleBundleExport({ document: createInitialDocument() }, config);
      rmSync(path.join(corruptRoot, "canvas-1", "_canvas.json"), { force: true });
      rmSync(path.join(corruptRoot, "canvas-1", "nodes"), { recursive: true, force: true });
      const response = await fetch(`http://127.0.0.1:${address.port}/api/bundle/load`);

      expect(response.status).toBe(422);
      const payload = (await response.json()) as { errors: string[] };
      expect(payload.errors.some((error) => error.includes("No node markdown files found"))).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        corruptServer.close((error) => (error ? reject(error) : resolve()));
      });
      rmSync(corruptRoot, { recursive: true, force: true });
    }
  });

  it("blocks load requests without the configured token", async () => {
    const protectedRoot = mkdtempSync(path.join(tmpdir(), "context-canvas-protected-api-bundle-"));
    const config = resolveContextCanvasServerConfig({
      CONTEXT_CANVAS_BUNDLE_ROOT: protectedRoot,
      CONTEXT_CANVAS_PORT: "0",
      CONTEXT_CANVAS_TOKEN: "dev-secret",
    });
    const protectedServer = createContextCanvasServer({ ...config, port: 0 });

    try {
      handleBundleExport({ document: createInitialDocument() }, config);
      await new Promise<void>((resolve) => {
        protectedServer.listen(0, "127.0.0.1", () => resolve());
      });
      const address = protectedServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to resolve test server port.");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/api/bundle/load`, {
        headers: { Origin: "http://localhost:5173" },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Invalid context canvas token." });
    } finally {
      await new Promise<void>((resolve, reject) => {
        protectedServer.close((error) => (error ? reject(error) : resolve()));
      });
      rmSync(protectedRoot, { recursive: true, force: true });
    }
  });
});
