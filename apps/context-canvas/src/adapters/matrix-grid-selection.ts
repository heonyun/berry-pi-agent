import {
  CompactSelection,
  emptyGridSelection,
  type GridSelection,
} from "@glideapps/glide-data-grid";
import type { RangeRefDTO } from "../shared/domain.ts";

/** Grid selection with Glide active cell (anchor for Enter/Tab). */
export interface MatrixGridSelectionState {
  readonly startCol: number;
  readonly startRow: number;
  readonly endCol: number;
  readonly endRow: number;
  readonly activeCol: number;
  readonly activeRow: number;
}

export interface GridSheetBounds {
  readonly rows: number;
  readonly cols: number;
}

function compactSelectionSpan(selection: CompactSelection): { start: number; end: number } | null {
  if (selection.length === 0) {
    return null;
  }
  const indices = selection.toArray();
  return { start: Math.min(...indices), end: Math.max(...indices) };
}

export function rangeRefToGridSelection(
  range: RangeRefDTO,
  activeCell?: { readonly col: number; readonly row: number },
): GridSelection {
  const activeCol = activeCell?.col ?? range.startCol;
  const activeRow = activeCell?.row ?? range.startRow;
  const width = range.endCol - range.startCol + 1;
  const height = range.endRow - range.startRow + 1;

  return {
    current: {
      cell: [activeCol, activeRow],
      range: {
        x: range.startCol,
        y: range.startRow,
        width,
        height,
      },
      rangeStack: [],
    },
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  };
}

export function matrixSelectionToRangeRef(
  selection: MatrixGridSelectionState,
): RangeRefDTO {
  return {
    startCol: selection.startCol,
    startRow: selection.startRow,
    endCol: selection.endCol,
    endRow: selection.endRow,
  };
}

export function clearedGridSelection(): GridSelection {
  return emptyGridSelection;
}

export function gridSelectionToMatrixSelection(
  selection: GridSelection,
  bounds?: GridSheetBounds,
): MatrixGridSelectionState | null {
  const rowSpan = bounds ? compactSelectionSpan(selection.rows) : null;
  if (rowSpan && bounds) {
    return {
      startCol: 0,
      startRow: rowSpan.start,
      endCol: bounds.cols - 1,
      endRow: rowSpan.end,
      activeCol: 0,
      activeRow: rowSpan.start,
    };
  }

  const colSpan = bounds ? compactSelectionSpan(selection.columns) : null;
  if (colSpan && bounds) {
    return {
      startCol: colSpan.start,
      startRow: 0,
      endCol: colSpan.end,
      endRow: bounds.rows - 1,
      activeCol: colSpan.start,
      activeRow: 0,
    };
  }

  if (!selection.current) {
    return null;
  }
  const { range, cell } = selection.current;
  if (range.width <= 0 || range.height <= 0) {
    return null;
  }
  const [activeCol, activeRow] = cell;
  return {
    startCol: range.x,
    startRow: range.y,
    endCol: range.x + range.width - 1,
    endRow: range.y + range.height - 1,
    activeCol,
    activeRow,
  };
}
