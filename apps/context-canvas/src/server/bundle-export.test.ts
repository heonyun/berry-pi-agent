import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInitialDocument } from "../shared/domain.ts";
import { CANVAS_SIDECAR } from "../storage/markdown/sidecar.ts";
import { createContextCanvasServer, handleBundleExport } from "./index.ts";
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
});
