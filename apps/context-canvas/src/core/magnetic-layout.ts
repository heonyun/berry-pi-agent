import {
  QA_BLOCK_MAGNETIC_DETACH_THRESHOLD,
  QA_BLOCK_COLUMN_TOLERANCE,
  QA_BLOCK_HORIZONTAL_GAP,
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

/** INVARIANT: edge visibility follows detach threshold from snap anchor (issue-39). */
export function blockDetached(position: Vec2, snapPosition: Vec2): boolean {
  const dx = Math.abs(position.x - snapPosition.x);
  const dy = Math.abs(position.y - snapPosition.y);
  return (
    dx > QA_BLOCK_MAGNETIC_DETACH_THRESHOLD || dy > QA_BLOCK_MAGNETIC_DETACH_THRESHOLD
  );
}
