import { describe, expect, it } from "vitest";
import { inferMatrixTargetRange } from "./matrix-target-inference.ts";

describe("inferMatrixTargetRange", () => {
  const bounds = { rows: 20, cols: 50 };

  it("infers a single-cell target below the selection", () => {
    expect(
      inferMatrixTargetRange({ startRow: 1, startCol: 1, endRow: 1, endCol: 1 }, "below", bounds),
    ).toEqual({
      ok: true,
      targetRange: { startRow: 2, startCol: 1, endRow: 2, endCol: 1 },
    });
  });

  it("infers a single-cell target to the right of the selection", () => {
    expect(
      inferMatrixTargetRange({ startRow: 1, startCol: 1, endRow: 1, endCol: 1 }, "right", bounds),
    ).toEqual({
      ok: true,
      targetRange: { startRow: 1, startCol: 2, endRow: 1, endCol: 2 },
    });
  });

  it("preserves a multi-cell selection width when inferring below", () => {
    expect(
      inferMatrixTargetRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, "below", bounds),
    ).toEqual({
      ok: true,
      targetRange: { startRow: 2, startCol: 0, endRow: 3, endCol: 1 },
    });
  });

  it("preserves a multi-cell selection height when inferring right", () => {
    expect(
      inferMatrixTargetRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, "right", bounds),
    ).toEqual({
      ok: true,
      targetRange: { startRow: 0, startCol: 2, endRow: 1, endCol: 3 },
    });
  });

  it("reports no room below without wrapping", () => {
    expect(
      inferMatrixTargetRange({ startRow: 19, startCol: 0, endRow: 19, endCol: 0 }, "below", bounds),
    ).toEqual({ ok: false, reason: "no-room-below" });
  });

  it("reports no room right without wrapping", () => {
    expect(
      inferMatrixTargetRange({ startRow: 0, startCol: 49, endRow: 0, endCol: 49 }, "right", bounds),
    ).toEqual({ ok: false, reason: "no-room-right" });
  });
});
