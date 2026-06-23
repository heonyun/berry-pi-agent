// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatStreamError } from "./format-stream-error.ts";

describe("formatStreamError", () => {
  it("maps usage_limit_reached JSON to a short Korean message", () => {
    const raw =
      'Codex error: {"type":"error","error":{"type":"usage_limit_reached","message":"The usage limit has been reached","status_code":429}}';
    expect(formatStreamError(raw)).toBe(
      "AI 사용 한도에 도달했습니다. 잠시 후 다시 시도하거나 플랜을 확인하세요.",
    );
  });

  it("extracts nested error.message from Codex JSON", () => {
    const raw = 'Codex error: {"error":{"message":"Model unavailable"}}';
    expect(formatStreamError(raw)).toBe("Model unavailable");
  });

  it("truncates long unstructured messages", () => {
    const raw = "x".repeat(200);
    const formatted = formatStreamError(raw);
    expect(formatted.length).toBeLessThanOrEqual(120);
    expect(formatted.endsWith("…")).toBe(true);
  });
});
