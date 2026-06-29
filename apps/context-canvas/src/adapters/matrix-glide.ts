import type { MatrixDocument, Cell } from "../shared/domain.ts";
import { cellKey } from "../shared/domain.ts";
import { formatStatusChip, parseCellFrontmatter } from "../shared/matrix-frontmatter.ts";
import {
  GridCellKind,
  Item,
  GridCell,
  TextCell,
  NumberCell,
  BooleanCell,
} from "@glideapps/glide-data-grid";

// ── Context Matrix -> glide-data-grid adapter ─────────────────────────────
// Grid library is renderer adapter only. Domain state (MatrixDocument) is the
// single source of truth. This module maps domain state to grid cells.
//
// INVARIANT: Inline text edits commit through onCellEdited → update_cell_body.
// Number/boolean cells stay read-only in-grid; markdown/frontmatter editing
// remains in the detail pane for multi-line and YAML.
// ─────────────────────────────────────────────────────────────────────────

export interface MatrixGridConfig {
  readonly rows: number;
  readonly cols: number;
}

/** Build the default config for a 20x50 sheet. */
export function getMatrixGridConfig(doc: MatrixDocument): MatrixGridConfig {
  return {
    rows: doc.sheet.rows,
    cols: doc.sheet.cols,
  };
}

/** Map a domain cell to a glide-data-grid cell. */
function domainCellToGridCell(domainCell: Cell | undefined): GridCell {
  if (!domainCell) {
    return {
      kind: GridCellKind.Text,
      data: "",
      displayData: "",
      allowOverlay: true,
      copyData: "",
    } as TextCell;
  }

  const summary = domainCell.body.split("\n")[0] || String(domainCell.value ?? "");
  const provenanceBadge = domainCell.provenance ? `[${domainCell.provenance}] ` : "";
  const parsedFm = parseCellFrontmatter(domainCell.frontmatter);
  const statusBadge = parsedFm.status ? `${formatStatusChip(String(parsedFm.status))} ` : "";
  const displayText = statusBadge + provenanceBadge + (summary || String(domainCell.value ?? ""));

  if (typeof domainCell.value === "number") {
    return {
      kind: GridCellKind.Number,
      data: domainCell.value,
      displayData: displayText,
      allowOverlay: false,
      copyData: String(domainCell.value),
    } as NumberCell;
  }

  if (typeof domainCell.value === "boolean") {
    return {
      kind: GridCellKind.Boolean,
      data: domainCell.value,
      displayData: displayText,
      allowOverlay: false as const,
      copyData: String(domainCell.value),
    } as BooleanCell;
  }

  return {
    kind: GridCellKind.Text,
    data: domainCell.body || String(domainCell.value ?? ""),
    displayData: displayText,
    allowOverlay: true,
    copyData: domainCell.body || String(domainCell.value ?? ""),
  } as TextCell;
}

/** Whether the grid should allow in-cell overlay editing for this cell kind. */
export function isMatrixCellEditable(cell: GridCell): boolean {
  return cell.kind === GridCellKind.Text && cell.allowOverlay === true;
}

/** Get a cell content function for glide-data-grid DataEditor. */
export function getCellContent(doc: MatrixDocument) {
  return (cell: Item): GridCell => {
    const [col, row] = cell;
    const key = cellKey(row, col);
    const domainCell = doc.sheet.cells.get(key);
    return domainCellToGridCell(domainCell);
  };
}
