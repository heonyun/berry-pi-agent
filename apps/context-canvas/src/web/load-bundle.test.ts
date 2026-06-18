import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBundle } from "./load-bundle.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadBundle", () => {
  it("treats 404 as an empty first-run canvas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ errors: ["missing"] }), { status: 404 })),
    );

    await expect(loadBundle()).resolves.toEqual({
      warnings: [],
      errors: ["No saved bundle found."],
    });
  });

  it("throws on non-404 load failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));

    await expect(loadBundle()).rejects.toThrow("forbidden");
  });
});
