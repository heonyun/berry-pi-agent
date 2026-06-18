import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialDocument } from "../shared/domain.ts";
import { loadBundle } from "./load-bundle.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadBundle", () => {
  it("returns the loaded document on success", async () => {
    const document = createInitialDocument();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ document, warnings: ["loaded"], errors: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(loadBundle()).resolves.toEqual({ document, warnings: ["loaded"], errors: [] });
  });

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ errors: ["Corrupt bundle", "No node markdown files found."] }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(loadBundle()).rejects.toThrow("Corrupt bundle No node markdown files found.");
  });
});
