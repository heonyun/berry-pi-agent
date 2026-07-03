import {
  cellKey,
  formatRangeLabel,
  type Cell,
  type MatrixDocument,
  type MatrixGroup,
  type RangeRefDTO,
} from "./domain.ts";

const MIN_GROUP_CELLS = 2;

interface Coord {
  readonly row: number;
  readonly col: number;
}

function hasMeaningfulContent(cell: Cell | undefined): boolean {
  if (!cell) {
    return false;
  }
  if (typeof cell.body === "string" && cell.body.trim().length > 0) {
    return true;
  }
  // CONTRACT: Legacy/wire cells may arrive with value undefined despite CellValue excluding it.
  return cell.value != null && String(cell.value).trim().length > 0;
}

function firstCellLabel(document: MatrixDocument, cells: readonly Coord[], fallback: string): string {
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const coord of sorted) {
    const cell = document.sheet.cells.get(cellKey(coord.row, coord.col));
    const text = cell?.body?.trim() || (cell?.value == null ? "" : String(cell.value).trim());
    if (!text) {
      continue;
    }
    const firstLine = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
    if (firstLine) {
      return firstLine.length > 28 ? `${firstLine.slice(0, 27)}...` : firstLine;
    }
  }
  return fallback;
}

function sortCellKeysByCoordinate(keys: Iterable<string>): string[] {
  return [...keys].sort((a, b) => {
    const [aRowText, aColText] = a.split(",");
    const [bRowText, bColText] = b.split(",");
    const aRow = Number.parseInt(aRowText!, 10);
    const aCol = Number.parseInt(aColText!, 10);
    const bRow = Number.parseInt(bRowText!, 10);
    const bCol = Number.parseInt(bColText!, 10);
    return aRow - bRow || aCol - bCol;
  });
}

function overlapArea(a: RangeRefDTO, b: RangeRefDTO): number {
  const rowStart = Math.max(a.startRow, b.startRow);
  const rowEnd = Math.min(a.endRow, b.endRow);
  const colStart = Math.max(a.startCol, b.startCol);
  const colEnd = Math.min(a.endCol, b.endCol);
  if (rowEnd < rowStart || colEnd < colStart) {
    return 0;
  }
  return (rowEnd - rowStart + 1) * (colEnd - colStart + 1);
}

function findPreviousGroup(
  previousGroups: ReadonlyMap<string, MatrixGroup> | undefined,
  id: string,
  range: RangeRefDTO,
): MatrixGroup | undefined {
  const exact = previousGroups?.get(id);
  if (exact) {
    return exact;
  }
  // INVARIANT: Renamed labels carry across recompute only when the new group overlaps old cells.
  // Adjacent-but-non-overlapping ranges are treated as fresh groups to avoid sticky wrong labels.
  let best: { readonly group: MatrixGroup; readonly score: number } | undefined;
  for (const group of previousGroups?.values() ?? []) {
    const score = overlapArea(group.range, range);
    if (score <= 0) {
      continue;
    }
    if (!best || score > best.score || (score === best.score && group.id < best.group.id)) {
      best = { group, score };
    }
  }
  return best?.group;
}

export function detectMatrixGroups(
  document: MatrixDocument,
  previousGroups: ReadonlyMap<string, MatrixGroup> = document.groups ?? new Map(),
): Map<string, MatrixGroup> {
  // WHY: Groups are derived from cells, so bundle load and every cell mutation can reconcile
  // stale persisted groups while preserving user labels/dismissals through previousGroups.
  const populated = new Set<string>();
  for (const [key, cell] of document.sheet.cells.entries()) {
    if (hasMeaningfulContent(cell)) {
      populated.add(key);
    }
  }

  const visited = new Set<string>();
  const detected = new Map<string, MatrixGroup>();

  for (const key of sortCellKeysByCoordinate(populated)) {
    if (visited.has(key)) {
      continue;
    }

    const [startRowText, startColText] = key.split(",");
    const queue: Coord[] = [
      { row: Number.parseInt(startRowText!, 10), col: Number.parseInt(startColText!, 10) },
    ];
    const component: Coord[] = [];
    visited.add(key);

    for (let index = 0; index < queue.length; index++) {
      const coord = queue[index]!;
      component.push(coord);
      for (const next of [
        { row: coord.row - 1, col: coord.col },
        { row: coord.row + 1, col: coord.col },
        { row: coord.row, col: coord.col - 1 },
        { row: coord.row, col: coord.col + 1 },
      ]) {
        const nextKey = cellKey(next.row, next.col);
        if (!populated.has(nextKey) || visited.has(nextKey)) {
          continue;
        }
        visited.add(nextKey);
        queue.push(next);
      }
    }

    if (component.length < MIN_GROUP_CELLS) {
      continue;
    }

    const range: RangeRefDTO = {
      startRow: Math.min(...component.map((coord) => coord.row)),
      startCol: Math.min(...component.map((coord) => coord.col)),
      endRow: Math.max(...component.map((coord) => coord.row)),
      endCol: Math.max(...component.map((coord) => coord.col)),
    };
    const id = `auto:${formatRangeLabel(range.startCol, range.startRow, range.endCol, range.endRow)}`;
    const previous = findPreviousGroup(previousGroups, id, range);
    if (previous?.dismissed && previous.id === id) {
      detected.set(id, { ...previous, id, range });
      continue;
    }
    const fallbackLabel = `Group ${detected.size + 1}`;
    detected.set(id, {
      id,
      label: previous?.label ?? firstCellLabel(document, component, fallbackLabel),
      range,
      source: "auto",
      labelOffset: previous?.labelOffset,
    });
  }

  return detected;
}

export function visibleMatrixGroups(document: MatrixDocument): MatrixGroup[] {
  return [...(document.groups ?? new Map()).values()].filter((group) => !group.dismissed);
}
