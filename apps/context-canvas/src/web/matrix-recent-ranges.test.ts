// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { loadRecentRanges, recordRecentRange, saveRecentRanges } from "./matrix-recent-ranges.ts";

describe("matrix-recent-ranges", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records and loads recent ranges from localStorage", () => {
    const entries = recordRecentRange([], { name: "inputs", rangeLabel: "@inputs" });
    saveRecentRanges(entries);

    const loaded = loadRecentRanges();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe("inputs");
    expect(loaded[0]?.rangeLabel).toBe("@inputs");
    expect(loaded[0]?.lastUsedAt).toBeTruthy();
  });

  it("moves duplicate name to front with updated timestamp", () => {
    const first = recordRecentRange([], { name: "outputs", rangeLabel: "@outputs" });
    const second = recordRecentRange(first, { name: "inputs", rangeLabel: "@inputs" });
    const third = recordRecentRange(second, { name: "outputs", rangeLabel: "@outputs" });

    expect(third).toHaveLength(2);
    expect(third[0]?.name).toBe("outputs");
    expect(third[1]?.name).toBe("inputs");
  });
});
