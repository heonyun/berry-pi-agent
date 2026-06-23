// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveNewBlockPlacement } from "./magnetic-layout.ts";

describe("resolveNewBlockPlacement", () => {
  it("places a parallel branch to the right of the upper block when selection has a block above", () => {
    const blocks = [
      { id: "block-top", position: { x: 0, y: -720 } },
      { id: "block-mid", position: { x: 0, y: -360 } },
      { id: "block-bottom", position: { x: 0, y: 0 } },
    ];

    const result = resolveNewBlockPlacement({
      blocks,
      selectedBlockId: "block-mid",
    });

    expect(result.mode).toBe("parallel");
    expect(result.position).toEqual({ x: 540, y: -720 });
  });

  it("stacks vertically above the selected block when it is the top of its column", () => {
    const blocks = [
      { id: "block-top", position: { x: 0, y: -360 } },
      { id: "block-bottom", position: { x: 0, y: 0 } },
    ];

    const result = resolveNewBlockPlacement({
      blocks,
      selectedBlockId: "block-top",
    });

    expect(result.mode).toBe("vertical");
    expect(result.position).toEqual({ x: 0, y: -720 });
  });

  it("stacks above the topmost block when nothing is selected", () => {
    const blocks = [
      { id: "block-top", position: { x: 100, y: -360 } },
      { id: "block-bottom", position: { x: 100, y: 0 } },
    ];

    const result = resolveNewBlockPlacement({
      blocks,
      selectedBlockId: null,
    });

    expect(result.mode).toBe("vertical");
    expect(result.position).toEqual({ x: 100, y: -720 });
  });
});
