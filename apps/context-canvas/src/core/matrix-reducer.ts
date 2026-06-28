import type {
  AiCommand,
  MatrixDocument,
  Cell,
  NamedRange,
  WritePatch,
  RangeRefDTO,
  SheetTemplate,
} from "../shared/domain.ts";
import { cellKey } from "../shared/domain.ts";
import { filterPatchesToTargetRange } from "../shared/matrix-validation.ts";

// ── Context Matrix commands ───────────────────────────────────────────────

export type MatrixCommand =
  | { type: "apply_patches"; patches: WritePatch[] }
  | { type: "update_cell_body"; row: number; col: number; body: string }
  | { type: "mock_ai_command"; targetRange: RangeRefDTO; patches: WritePatch[] }
  | { type: "apply_ai_command"; command: AiCommand }
  | { type: "set_named_range"; namedRange: NamedRange }
  | { type: "remove_named_range"; name: string }
  | { type: "update_cell_frontmatter"; row: number; col: number; frontmatter: string }
  | { type: "apply_template"; template: SheetTemplate; resizeCols?: number }
  | { type: "clear_cell"; row: number; col: number };

export interface MatrixApplyResult {
  document: MatrixDocument;
  meta: {
    updatedCells: number;
    message?: string;
    targetRange?: RangeRefDTO;
    strippedPatches?: number;
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

    case "apply_ai_command": {
      const { patches, strippedCount } = filterPatchesToTargetRange(
        command.command.patches,
        command.command.targetRange,
      );
      const result = applyPatches(document, patches);
      let message = command.command.intent;
      if (strippedCount > 0) {
        message = `${message} — ${strippedCount} patch(es) outside target range skipped`;
      }
      return {
        ...result,
        meta: {
          ...result.meta,
          targetRange: command.command.targetRange,
          message,
          strippedPatches: strippedCount > 0 ? strippedCount : undefined,
        },
      };
    }

    case "set_named_range": {
      const nextNamedRanges = new Map(document.namedRanges);
      nextNamedRanges.set(command.namedRange.name, command.namedRange);
      return {
        document: { ...document, namedRanges: nextNamedRanges },
        meta: {
          updatedCells: 0,
          message: `Named range "${command.namedRange.name}" saved`,
        },
      };
    }

    case "remove_named_range": {
      const nextNamedRanges = new Map(document.namedRanges);
      nextNamedRanges.delete(command.name);
      return {
        document: { ...document, namedRanges: nextNamedRanges },
        meta: { updatedCells: 0, message: `Named range "${command.name}" removed` },
      };
    }

    case "update_cell_frontmatter": {
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
        body: existing?.body ?? "",
        frontmatter: command.frontmatter,
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

    case "apply_template": {
      const nextCols =
        command.resizeCols !== undefined
          ? Math.max(command.resizeCols, document.sheet.cols)
          : document.sheet.cols;
      return {
        document: {
          ...document,
          schemaVersion: 4,
          templateId: command.template.id,
          template: command.template,
          sheet: { ...document.sheet, cols: nextCols },
        },
        meta: {
          updatedCells: 0,
          message: `Template "${command.template.name}" applied`,
        },
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
