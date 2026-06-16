import { describe, expect, it } from "vitest";
import { buildPromptRequestHeaders } from "./api.ts";

describe("buildPromptRequestHeaders", () => {
  it("includes the context canvas token when configured", () => {
    expect(buildPromptRequestHeaders("dev-secret")).toEqual({
      "Content-Type": "application/json",
      "X-Context-Canvas-Token": "dev-secret",
    });
  });

  it("omits the context canvas token when it is not configured", () => {
    expect(buildPromptRequestHeaders("")).toEqual({
      "Content-Type": "application/json",
    });
  });
});
