import {
  QA_BLOCK_APPROX_HEIGHT,
  QA_BLOCK_MAGNETIC_DETACH_THRESHOLD,
  QA_BLOCK_COLUMN_TOLERANCE,
  QA_BLOCK_HORIZONTAL_GAP,
  QA_BLOCK_STACK_GAP,
  QA_BLOCK_VERTICAL_GAP,
  type QABlock,
  type Vec2,
} from "../shared/domain.ts";

export interface MagneticPlacementInput {
  blocks: ReadonlyArray<Pick<QABlock, "id" | "position">>;
  selectedBlockId: string | null;
  /** Bottom composer or pane double-click anchor when the canvas is empty. */
  anchor?: Vec2;
}

export interface MagneticPlacementResult {
  position: Vec2;
  /** `vertical` = stack above; `parallel` = branch right of upper block. */
  mode: "vertical" | "parallel" | "anchor";
}

function sameColumn(a: Vec2, b: Vec2, tolerance = QA_BLOCK_COLUMN_TOLERANCE): boolean {
  return Math.abs(a.x - b.x) <= tolerance;
}

function blockAbove(
  blocks: ReadonlyArray<Pick<QABlock, "id" | "position">>,
  selected: Pick<QABlock, "id" | "position">,
): Pick<QABlock, "id" | "position"> | null {
  const candidates = blocks.filter(
    (block) =>
      block.id !== selected.id &&
      block.position.y < selected.position.y &&
      sameColumn(block.position, selected.position),
  );
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((closest, block) =>
    block.position.y > closest.position.y ? block : closest,
  );
}

function topmostBlock(
  blocks: ReadonlyArray<Pick<QABlock, "id" | "position">>,
): Pick<QABlock, "id" | "position"> | null {
  if (blocks.length === 0) {
    return null;
  }
  return blocks.reduce((top, block) => (block.position.y < top.position.y ? block : top));
}

function isOccupied(blocks: ReadonlyArray<Pick<QABlock, "position">>, position: Vec2): boolean {
  return blocks.some(
    (block) =>
      Math.abs(block.position.x - position.x) <= QA_BLOCK_COLUMN_TOLERANCE &&
      Math.abs(block.position.y - position.y) <= QA_BLOCK_COLUMN_TOLERANCE,
  );
}

/** INVARIANT: placement matches spec v0.1 — selection branches right of upper block, else stack above. */
export function resolveNewBlockPlacement(input: MagneticPlacementInput): MagneticPlacementResult {
  const anchor = input.anchor ?? { x: 0, y: 0 };
  const { blocks, selectedBlockId } = input;

  if (blocks.length === 0) {
    return { position: anchor, mode: "anchor" };
  }

  if (!selectedBlockId) {
    const top = topmostBlock(blocks);
    if (!top) {
      return { position: anchor, mode: "anchor" };
    }
    return {
      position: { x: top.position.x, y: top.position.y - QA_BLOCK_VERTICAL_GAP },
      mode: "vertical",
    };
  }

  const selected = blocks.find((block) => block.id === selectedBlockId);
  if (!selected) {
    const top = topmostBlock(blocks);
    return {
      position: top
        ? { x: top.position.x, y: top.position.y - QA_BLOCK_VERTICAL_GAP }
        : anchor,
      mode: top ? "vertical" : "anchor",
    };
  }

  const upper = blockAbove(blocks, selected);
  if (upper) {
    let x = upper.position.x + QA_BLOCK_HORIZONTAL_GAP;
    const y = upper.position.y;
    while (isOccupied(blocks, { x, y })) {
      x += QA_BLOCK_HORIZONTAL_GAP;
    }
    return { position: { x, y }, mode: "parallel" };
  }

  return {
    position: { x: selected.position.x, y: selected.position.y - QA_BLOCK_VERTICAL_GAP },
    mode: "vertical",
  };
}

function columnKey(x: number): number {
  return Math.round(x / QA_BLOCK_COLUMN_TOLERANCE) * QA_BLOCK_COLUMN_TOLERANCE;
}

function blocksInColumn(
  blocks: ReadonlyArray<Pick<QABlock, "id" | "position">>,
  x: number,
): Array<Pick<QABlock, "id" | "position">> {
  const key = columnKey(x);
  return blocks.filter((block) => columnKey(block.position.x) === key);
}

/**
 * Repositions magnetically attached blocks in each column using measured heights.
 * Bottom block in a column keeps its Y; blocks above stack with QA_BLOCK_STACK_GAP.
 */
export function reflowMagneticStacks(
  blocks: ReadonlyArray<Pick<QABlock, "id" | "position" | "snapPosition">>,
  blockHeights: ReadonlyMap<string, number>,
  stackGap = QA_BLOCK_STACK_GAP,
): Map<string, Vec2> {
  const attached = blocks.filter(
    (block) => !blockDetached(block.position, block.snapPosition),
  );
  if (attached.length === 0) {
    return new Map();
  }

  const columns = new Map<number, Array<Pick<QABlock, "id" | "position" | "snapPosition">>>();
  for (const block of attached) {
    const key = columnKey(block.position.x);
    const column = columns.get(key) ?? [];
    column.push(block);
    columns.set(key, column);
  }

  const positions = new Map<string, Vec2>();
  for (const column of columns.values()) {
    const sorted = [...column].sort((a, b) => b.position.y - a.position.y);
    const bottom = sorted[0];
    if (!bottom) {
      continue;
    }
    positions.set(bottom.id, { x: bottom.position.x, y: bottom.position.y });
    for (let index = 1; index < sorted.length; index += 1) {
      const block = sorted[index]!;
      const below = sorted[index - 1]!;
      const belowTop = positions.get(below.id)!.y;
      const height = blockHeights.get(block.id) ?? QA_BLOCK_APPROX_HEIGHT;
      const y = belowTop - stackGap - height;
      positions.set(block.id, { x: block.position.x, y });
    }
  }
  return positions;
}

/** Blocks in the same column as `blockId`, sorted top-to-bottom (smallest Y first). */
export function columnBlocksSorted(
  blocks: ReadonlyArray<Pick<QABlock, "id" | "position">>,
  blockId: string | null,
): Array<Pick<QABlock, "id" | "position">> {
  if (!blockId) {
    return [...blocks].sort((a, b) => a.position.y - b.position.y);
  }
  const selected = blocks.find((block) => block.id === blockId);
  if (!selected) {
    return [...blocks].sort((a, b) => a.position.y - b.position.y);
  }
  return blocksInColumn(blocks, selected.position.x).sort((a, b) => a.position.y - b.position.y);
}

/** INVARIANT: edge visibility follows detach threshold from snap anchor (issue-39). */
export function blockDetached(position: Vec2, snapPosition: Vec2): boolean {
  const dx = Math.abs(position.x - snapPosition.x);
  const dy = Math.abs(position.y - snapPosition.y);
  return (
    dx > QA_BLOCK_MAGNETIC_DETACH_THRESHOLD || dy > QA_BLOCK_MAGNETIC_DETACH_THRESHOLD
  );
}
