import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendMatrixSessionEvent,
  clearMatrixSessionLog,
  exportMatrixSessionLogJson,
  isMatrixSessionLogEnabled,
  loadMatrixSessionLog,
} from "./matrix-session-log.ts";

describe("matrix-session-log", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_CONTEXT_CANVAS_DEBUG_LOG", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is enabled in dev by default", () => {
    expect(isMatrixSessionLogEnabled()).toBe(true);
  });

  it("can be forced off with VITE_CONTEXT_CANVAS_DEBUG_LOG=0", () => {
    vi.stubEnv("VITE_CONTEXT_CANVAS_DEBUG_LOG", "0");
    expect(isMatrixSessionLogEnabled()).toBe(false);
  });

  it("appends events to localStorage ring buffer", () => {
    appendMatrixSessionEvent("status", { message: "Ready" });
    appendMatrixSessionEvent("shortcut", { direction: "below", blocked: true });

    const events = loadMatrixSessionLog();
    expect(events).toHaveLength(2);
    expect(events[0]?.kind).toBe("shortcut");
    expect(events[1]?.kind).toBe("status");
  });

  it("truncates long strings and omits token-like fields", () => {
    appendMatrixSessionEvent("error", {
      message: "x".repeat(300),
      api_key: "secret",
    });
    const detail = loadMatrixSessionLog()[0]?.detail ?? {};
    expect(detail.api_key).toBeUndefined();
    expect(String(detail.message)).toHaveLength(201);
  });

  it("exports JSON for issue handoff", () => {
    appendMatrixSessionEvent("run_end", { outcome: "failure" });
    clearMatrixSessionLog();
    appendMatrixSessionEvent("run_end", { outcome: "success" });
    expect(JSON.parse(exportMatrixSessionLogJson())).toHaveLength(1);
  });
});
