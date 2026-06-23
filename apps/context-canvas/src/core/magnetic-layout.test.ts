// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveNewBlockPlacement, reflowMagneticStacks, columnBlocksSorted } from "./magnetic-layout.ts";

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

describe("reflowMagneticStacks", () => {
  it("stacks attached column blocks using measured heights and stack gap", () => {
    const blocks = [
      {
        id: "bottom",
        position: { x: 0, y: 0 },
        snapPosition: { x: 0, y: 0 },
      },
      {
        id: "top",
        position: { x: 0, y: -360 },
        snapPosition: { x: 0, y: -360 },
      },
    ];
    const heights = new Map([
      ["bottom", 120],
      ["top", 80],
    ]);

    const positions = reflowMagneticStacks(blocks, heights, 20);

    expect(positions.get("bottom")).toEqual({ x: 0, y: 0 });
    expect(positions.get("top")).toEqual({ x: 0, y: -100 });
  });
});

describe("columnBlocksSorted", () => {
  it("returns blocks in the same column sorted top-to-bottom", () => {
    const blocks = [
      { id: "a", position: { x: 0, y: -200 } },
      { id: "b", position: { x: 0, y: 0 } },
      { id: "c", position: { x: 540, y: 0 } },
    ];

    const ordered = columnBlocksSorted(blocks, "b");
    expect(ordered.map((block) => block.id)).toEqual(["a", "b"]);
  });
});
