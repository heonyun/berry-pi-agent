import {
  cellKey,
  type Cell,
  type MatrixDocument,
  type MatrixGroup,
} from "../shared/domain.ts";

export type MatrixEditOperationType =
  | "cells.edit"
  | "group.rename"
  | "group.move"
  | "group.dismiss"
  | "ai.apply";

export interface MatrixEditCellRef {
  readonly row: number;
  readonly col: number;
}

export interface MatrixEditCellSnapshot extends MatrixEditCellRef {
  readonly cell: Cell | null;
}

export interface MatrixEditDocumentSlice {
  readonly cells: readonly MatrixEditCellSnapshot[];
  readonly groups: readonly MatrixGroup[];
}

export interface MatrixEditHistoryEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly label: string;
  readonly operationType: MatrixEditOperationType;
  readonly before: MatrixEditDocumentSlice;
  readonly after: MatrixEditDocumentSlice;
}

export interface MatrixEditHistoryState {
  readonly undoStack: readonly MatrixEditHistoryEntry[];
  readonly redoStack: readonly MatrixEditHistoryEntry[];
}

export interface CreateMatrixEditHistoryEntryInput {
  readonly operationType: MatrixEditOperationType;
  readonly label: string;
  readonly beforeDocument: MatrixDocument;
  readonly afterDocument: MatrixDocument;
  readonly affectedCells: readonly MatrixEditCellRef[];
}

const MAX_EDIT_HISTORY = 50;

// RELATED: issue-135 — session-only Matrix/Grid edit undo stack.
export function createMatrixEditHistoryState(): MatrixEditHistoryState {
  return { undoStack: [], redoStack: [] };
}

export function createMatrixEditHistoryEntry(
  input: CreateMatrixEditHistoryEntryInput,
): MatrixEditHistoryEntry | null {
  const before = sliceMatrixDocument(input.beforeDocument, input.affectedCells);
  const after = sliceMatrixDocument(input.afterDocument, input.affectedCells);
  if (stableStringify(before) === stableStringify(after)) {
    return null;
  }
  return {
    id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    label: input.label,
    operationType: input.operationType,
    before,
    after,
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonKeys(value));
}

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJsonKeys(child)]),
    );
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function pushMatrixEditHistoryEntry(
  state: MatrixEditHistoryState,
  entry: MatrixEditHistoryEntry | null,
): MatrixEditHistoryState {
  if (!entry) {
    return state;
  }
  return {
    undoStack: [entry, ...state.undoStack].slice(0, MAX_EDIT_HISTORY),
    redoStack: [],
  };
}

export function restoreMatrixEditHistoryEntry(
  document: MatrixDocument,
  entry: MatrixEditHistoryEntry,
  direction: "undo" | "redo",
): MatrixDocument {
  const slice = direction === "undo" ? entry.before : entry.after;
  const cells = new Map(document.sheet.cells);
  for (const snapshot of slice.cells) {
    const key = cellKey(snapshot.row, snapshot.col);
    if (snapshot.cell) {
      cells.set(key, snapshot.cell);
    } else {
      cells.delete(key);
    }
  }
  return {
    ...document,
    sheet: { ...document.sheet, cells },
    groups: new Map(slice.groups.map((group) => [group.id, group] as const)),
  };
}

export function undoMatrixEditHistory(
  document: MatrixDocument,
  state: MatrixEditHistoryState,
): { readonly document: MatrixDocument; readonly state: MatrixEditHistoryState; readonly entry: MatrixEditHistoryEntry | null } {
  const [entry, ...rest] = state.undoStack;
  if (!entry) {
    return { document, state, entry: null };
  }
  return {
    document: restoreMatrixEditHistoryEntry(document, entry, "undo"),
    state: {
      undoStack: rest,
      redoStack: [entry, ...state.redoStack].slice(0, MAX_EDIT_HISTORY),
    },
    entry,
  };
}

export function redoMatrixEditHistory(
  document: MatrixDocument,
  state: MatrixEditHistoryState,
): { readonly document: MatrixDocument; readonly state: MatrixEditHistoryState; readonly entry: MatrixEditHistoryEntry | null } {
  const [entry, ...rest] = state.redoStack;
  if (!entry) {
    return { document, state, entry: null };
  }
  return {
    document: restoreMatrixEditHistoryEntry(document, entry, "redo"),
    state: {
      undoStack: [entry, ...state.undoStack].slice(0, MAX_EDIT_HISTORY),
      redoStack: rest,
    },
    entry,
  };
}

function sliceMatrixDocument(
  document: MatrixDocument,
  affectedCells: readonly MatrixEditCellRef[],
): MatrixEditDocumentSlice {
  const seen = new Set<string>();
  const cells: MatrixEditCellSnapshot[] = [];
  for (const ref of affectedCells) {
    const key = cellKey(ref.row, ref.col);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cells.push({
      row: ref.row,
      col: ref.col,
      cell: document.sheet.cells.get(key) ?? null,
    });
  }
  cells.sort((a, b) => a.row - b.row || a.col - b.col);
  return {
    cells,
    groups: [...document.groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
