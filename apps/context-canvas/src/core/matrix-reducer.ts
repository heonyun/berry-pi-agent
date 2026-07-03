import type {
  AiCommand,
  MatrixDocument,
  Cell,
  NamedRange,
  WritePatch,
  RangeRefDTO,
  SheetTemplate,
} from "../shared/domain.ts";
import { cellKey, formatColumnLabel } from "../shared/domain.ts";
import { clampMatrixColumnWidth } from "../shared/matrix-column-width.ts";
import { clampMatrixRowHeight } from "../shared/matrix-row-height.ts";
import { detectMatrixGroups } from "../shared/matrix-groups.ts";
import { filterPatchesToTargetRange } from "../shared/matrix-validation.ts";

// ── Context Matrix commands ───────────────────────────────────────────────

export type MatrixCommand =
  | { type: "apply_patches"; patches: WritePatch[] }
  | { type: "update_cell_body"; row: number; col: number; body: string }
  | { type: "mock_ai_command"; targetRange: RangeRefDTO; patches: WritePatch[] }
  | { type: "apply_ai_command"; command: AiCommand }
  | { type: "set_named_range"; namedRange: NamedRange }
  | { type: "remove_named_range"; name: string }
  | { type: "set_group_label"; id: string; label: string }
  | { type: "set_group_label_offset"; id: string; offset: { x: number; y: number } }
  | { type: "dismiss_group"; id: string }
  | { type: "set_column_custom_label"; col: number; label: string }
  | { type: "set_column_width"; col: number; width: number }
  | { type: "set_row_height"; row: number; height: number }
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
      const nextDocument = withDetectedGroups({
        ...document,
        sheet: { ...document.sheet, cells: nextCells },
      });
      return {
        document: nextDocument,
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
      // RELATED: matrix-reducer.test.ts "apply_ai_command strips patches outside targetRange with warning meta"
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

    case "set_group_label": {
      const group = document.groups?.get(command.id);
      if (!group) {
        return {
          document,
          meta: { updatedCells: 0 },
        };
      }
      const label = command.label.trim();
      if (!label) {
        return {
          document,
          meta: { updatedCells: 0 },
        };
      }
      const hasCollision = [...(document.groups ?? new Map()).values()].some(
        (candidate) => candidate.id !== group.id && candidate.label.trim() === label,
      );
      if (hasCollision) {
        return {
          document,
          meta: { updatedCells: 0, message: `Group label already exists: ${label}` },
        };
      }
      const nextGroups = new Map(document.groups ?? []);
      nextGroups.set(group.id, { ...group, label });
      return {
        document: { ...document, groups: nextGroups },
        meta: {
          updatedCells: 0,
          message: `Group label updated: ${label}`,
        },
      };
    }

    case "set_group_label_offset": {
      const group = document.groups?.get(command.id);
      if (!group || !Number.isFinite(command.offset.x) || !Number.isFinite(command.offset.y)) {
        return {
          document,
          meta: { updatedCells: 0 },
        };
      }
      const nextGroups = new Map(document.groups ?? []);
      nextGroups.set(group.id, {
        ...group,
        labelOffset: { x: Math.round(command.offset.x), y: Math.round(command.offset.y) },
      });
      return {
        document: { ...document, groups: nextGroups },
        meta: {
          updatedCells: 0,
          message: `Group label moved: ${group.label}`,
        },
      };
    }

    case "dismiss_group": {
      const group = document.groups?.get(command.id);
      if (!group) {
        return {
          document,
          meta: { updatedCells: 0 },
        };
      }
      const nextGroups = new Map(document.groups ?? []);
      nextGroups.set(group.id, { ...group, dismissed: true });
      return {
        document: { ...document, groups: nextGroups },
        meta: {
          updatedCells: 0,
          message: `Group hidden: ${group.label}`,
        },
      };
    }

    case "set_column_custom_label": {
      if (command.col < 0 || command.col >= document.sheet.cols) {
        return {
          document,
          meta: { updatedCells: 0 },
        };
      }
      const nextLabels = new Map(document.customColumnLabels ?? []);
      const label = command.label.trim();
      if (label) {
        nextLabels.set(command.col, label);
      } else {
        nextLabels.delete(command.col);
      }
      const coordinate = formatColumnLabel(command.col);
      return {
        document: { ...document, customColumnLabels: nextLabels },
        meta: {
          updatedCells: 0,
          message: label
            ? `Column ${coordinate} label updated: ${label}`
            : `Column ${coordinate} label cleared`,
        },
      };
    }

    case "set_column_width": {
      if (command.col < 0 || command.col >= document.sheet.cols) {
        return { document, meta: { updatedCells: 0 } };
      }
      const width = clampMatrixColumnWidth(command.width);
      const nextWidths = new Map(document.columnWidths ?? []);
      nextWidths.set(command.col, width);
      const coordinate = formatColumnLabel(command.col);
      return {
        document: { ...document, columnWidths: nextWidths },
        meta: {
          updatedCells: 0,
          message: `Column ${coordinate} width: ${width}px`,
        },
      };
    }

    case "set_row_height": {
      if (command.row < 0 || command.row >= document.sheet.rows) {
        return { document, meta: { updatedCells: 0 } };
      }
      const height = clampMatrixRowHeight(command.height);
      const nextHeights = new Map(document.rowHeights ?? []);
      nextHeights.set(command.row, height);
      return {
        document: { ...document, rowHeights: nextHeights },
        meta: {
          updatedCells: 0,
          message: `Row ${command.row + 1} height: ${height}px`,
        },
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
      const nextDocument = withDetectedGroups({
        ...document,
        sheet: { ...document.sheet, cells: nextCells },
      });
      return {
        document: nextDocument,
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
          customColumnLabels: new Map(document.customColumnLabels ?? []),
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
      const nextDocument = withDetectedGroups({
        ...document,
        sheet: { ...document.sheet, cells: nextCells },
      });
      return {
        document: nextDocument,
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
    document: withDetectedGroups({
      ...document,
      sheet: { ...document.sheet, cells: nextCells },
    }),
    meta: { updatedCells },
  };
}

function withDetectedGroups(document: MatrixDocument): MatrixDocument {
  return {
    ...document,
    groups: detectMatrixGroups(document, document.groups),
  };
}

/** INVARIANT: Out-of-bounds patches and direct cell commands are silently skipped (no throw). */
function isCellInBounds(document: MatrixDocument, row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < document.sheet.rows && col < document.sheet.cols;
}
