import type { MatrixDocument, Cell, WritePatch, RangeRefDTO } from "../shared/domain.ts";
import { cellKey } from "../shared/domain.ts";

// ── Context Matrix commands ───────────────────────────────────────────────

export type MatrixCommand =
  | { type: "apply_patches"; patches: WritePatch[] }
  | { type: "update_cell_body"; row: number; col: number; body: string }
  | { type: "mock_ai_command"; targetRange: RangeRefDTO; patches: WritePatch[] }
  | { type: "clear_cell"; row: number; col: number };

export interface MatrixApplyResult {
  document: MatrixDocument;
  meta: {
    updatedCells: number;
    message?: string;
    targetRange?: RangeRefDTO;
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────

export function applyMatrixCommand(
  document: MatrixDocument,
  command: MatrixCommand,
): MatrixApplyResult {
  switch (command.type) {
    case "apply_patches": {
      return applyPatches(document, command.patches);
    }

    case "update_cell_body": {
      if (!isCellInBounds(document, command.row, command.col)) {
        return {
          document,
          meta: { updatedCells: 0 },
        };
      }
      const key = cellKey(command.row, command.col);
      const existing = document.sheet.cells.get(key);
      const updatedCell: Cell = {
        value: existing?.value ?? null,
        body: command.body,
        frontmatter: existing?.frontmatter ?? "",
        provenance: existing?.provenance,
      };
      const nextCells = new Map(document.sheet.cells);
      nextCells.set(key, updatedCell);
      return {
        document: {
          ...document,
          sheet: { ...document.sheet, cells: nextCells },
        },
        meta: { updatedCells: 1 },
      };
    }

    case "mock_ai_command": {
      const result = applyPatches(document, command.patches);
      const { targetRange } = command;
      return {
        ...result,
        meta: { ...result.meta, targetRange },
      };
    }

    case "clear_cell": {
      if (!isCellInBounds(document, command.row, command.col)) {
        return {
          document,
          meta: { updatedCells: 0 },
        };
      }
      const key = cellKey(command.row, command.col);
      const nextCells = new Map(document.sheet.cells);
      nextCells.delete(key);
      return {
        document: {
          ...document,
          sheet: { ...document.sheet, cells: nextCells },
        },
        meta: { updatedCells: 1 },
      };
    }

    default: {
      const exhaustive: never = command;
      throw new Error(`Unhandled matrix command: ${(exhaustive as MatrixCommand).type}`);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

function applyPatches(
  document: MatrixDocument,
  patches: WritePatch[],
): MatrixApplyResult {
  const nextCells = new Map(document.sheet.cells);
  let updatedCells = 0;

  for (const patch of patches) {
    const key = cellKey(patch.row, patch.col);

    if (!isCellInBounds(document, patch.row, patch.col)) {
      continue;
    }

    const existing = nextCells.get(key);
    const updatedCell: Cell = {
      value: patch.value,
      body: patch.body,
      frontmatter: patch.frontmatter ?? existing?.frontmatter ?? "",
      provenance: patch.provenance ?? existing?.provenance,
    };
    nextCells.set(key, updatedCell);
    updatedCells++;
  }

  return {
    document: {
      ...document,
      sheet: { ...document.sheet, cells: nextCells },
    },
    meta: { updatedCells },
  };
}

function isCellInBounds(document: MatrixDocument, row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < document.sheet.rows && col < document.sheet.cols;
}
