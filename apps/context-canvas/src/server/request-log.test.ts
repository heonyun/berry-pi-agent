import { describe, expect, it } from "vitest";
import {
  createRequestLogId,
  formatRequestLogLine,
  normalizeRequestPath,
  shouldLogContextCanvasRequests,
} from "./request-log.ts";

describe("request-log", () => {
  it("enables logging when CONTEXT_CANVAS_REQUEST_LOG=1", () => {
    expect(shouldLogContextCanvasRequests({ CONTEXT_CANVAS_REQUEST_LOG: "1", NODE_ENV: "production" })).toBe(
      true,
    );
  });

  it("disables logging when CONTEXT_CANVAS_REQUEST_LOG=0", () => {
    expect(shouldLogContextCanvasRequests({ CONTEXT_CANVAS_REQUEST_LOG: "0", NODE_ENV: "development" })).toBe(
      false,
    );
  });

  it("strips query strings from request paths", () => {
    expect(normalizeRequestPath("/api/health?x=1")).toBe("/api/health");
  });

  it("formats request log lines with extras", () => {
    const line = formatRequestLogLine(
      {
        reqId: "abcd1234",
        method: "POST",
        path: "/api/matrix-run",
        startedAtMs: 1000,
        extra: { promptLen: 12, target: "C6:C6" },
      },
      200,
      1842,
    );
    expect(line).toContain("reqId=abcd1234");
    expect(line).toContain("POST /api/matrix-run 200 842ms");
    expect(line).toContain("promptLen=12");
    expect(createRequestLogId()).toHaveLength(8);
  });
});
