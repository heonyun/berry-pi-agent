import fs from "node:fs";
import path from "node:path";
import type {
  Cell,
  CellValue,
  MatrixDocument,
  MatrixGroup,
  SheetTemplate,
} from "../../shared/domain.ts";
import { cellKey } from "../../shared/domain.ts";
import { clampMatrixColumnWidth } from "../../shared/matrix-column-width.ts";
import { clampMatrixRowHeight } from "../../shared/matrix-row-height.ts";
import { detectMatrixGroups } from "../../shared/matrix-groups.ts";
import { parse } from "../markdown/document.ts";
import { assertSafeId } from "../markdown/paths.ts";
import { cellsDir, pathToCellCoord } from "./paths.ts";
import { readMatrixHistory } from "./history.ts";
import { readMatrixManifest } from "./sidecar.ts";
import { MATRIX_SIDECAR } from "./sidecar.ts";
import type { LoadResult } from "./types.ts";
import { templatePath } from "./paths.ts";

export function loadMatrixBundle(bundleRoot: string): LoadResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(bundleRoot)) {
    return { warnings, errors: [`Bundle directory not found: ${bundleRoot}`] };
  }

  const manifest = readMatrixManifest(bundleRoot);
  if (!manifest) {
    return {
      warnings,
      errors: [`Missing or invalid ${MATRIX_SIDECAR}.`],
    };
  }

  const cellFiles = listCellFiles(bundleRoot);
  if (cellFiles.length === 0 && manifest.rows * manifest.cols > 0) {
    warnings.push("No cell markdown files found; loading empty sparse sheet.");
  }

  const cells = new Map<string, Cell>();
  for (const filePath of cellFiles) {
    const coord = pathToCellCoord(bundleRoot, filePath);
    if (!coord) {
      warnings.push(`Skipping unrecognized cell path: ${filePath}`);
      continue;
    }

    try {
      const markdown = parse(fs.readFileSync(filePath, "utf8"));
      const cell = cellFromMarkdown(markdown, coord, warnings, filePath, bundleRoot);
      if (cell) {
        cells.set(cellKey(coord.row, coord.col), cell);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${path.relative(bundleRoot, filePath)}: ${message}`);
    }
  }

  const template = loadTemplate(bundleRoot, manifest.templateId, warnings);
  const namedRanges = new Map(manifest.namedRanges.map((entry) => [entry.name, entry]));
  const groups = new Map(
    (Array.isArray(manifest.groups) ? manifest.groups : [])
      .filter((entry): entry is MatrixGroup => isValidManifestGroup(entry, manifest.rows, manifest.cols))
      .map((entry) => [entry.id, entry] as const),
  );
  const customColumnLabels = new Map(
    (Array.isArray(manifest.customColumnLabels) ? manifest.customColumnLabels : [])
      .filter((entry) => Number.isInteger(entry.col) && typeof entry.label === "string")
      .filter((entry) => entry.col >= 0 && entry.col < manifest.cols)
      .map((entry) => [entry.col, entry.label.trim()] as const)
      .filter((entry) => entry[1].length > 0),
  );
  const columnWidths = new Map(
    (Array.isArray(manifest.columnWidths) ? manifest.columnWidths : [])
      .filter((entry) => Number.isInteger(entry.col) && typeof entry.width === "number")
      .filter((entry) => entry.col >= 0 && entry.col < manifest.cols)
      .map((entry) => [entry.col, clampMatrixColumnWidth(entry.width)] as const),
  );
  const rowHeights = new Map(
    (Array.isArray(manifest.rowHeights) ? manifest.rowHeights : [])
      .filter((entry) => Number.isInteger(entry.row) && typeof entry.height === "number")
      .filter((entry) => entry.row >= 0 && entry.row < manifest.rows)
      .map((entry) => [entry.row, clampMatrixRowHeight(entry.height)] as const),
  );

  const document: MatrixDocument = {
    kind: "matrix",
    schemaVersion: 4,
    sheet: {
      id: manifest.sheetId,
      name: manifest.sheetName,
      rows: manifest.rows,
      cols: manifest.cols,
      cells,
    },
    namedRanges,
    groups,
    customColumnLabels,
    ...(columnWidths.size > 0 ? { columnWidths } : {}),
    ...(rowHeights.size > 0 ? { rowHeights } : {}),
    ...(manifest.templateId ? { templateId: manifest.templateId } : {}),
    ...(template ? { template } : {}),
  };
  // CONTRACT: Manifest groups are persisted hints, not authority; cells remain source of truth.
  const reconciledDocument: MatrixDocument = {
    ...document,
    groups: detectMatrixGroups(document, groups),
  };

  if (errors.length > 0) {
    return { warnings, errors };
  }

  const history = readMatrixHistory(bundleRoot);

  return { document: reconciledDocument, history, warnings, errors };
}

function isValidManifestGroup(
  value: MatrixGroup,
  rows: number,
  cols: number,
): value is MatrixGroup {
  return (
    typeof value?.id === "string" &&
    value.id.length > 0 &&
    typeof value.label === "string" &&
    value.label.trim().length > 0 &&
    value.source === "auto" &&
    Number.isInteger(value.range?.startRow) &&
    Number.isInteger(value.range?.startCol) &&
    Number.isInteger(value.range?.endRow) &&
    Number.isInteger(value.range?.endCol) &&
    value.range.startRow >= 0 &&
    value.range.startCol >= 0 &&
    value.range.endRow >= value.range.startRow &&
    value.range.endCol >= value.range.startCol &&
    value.range.endRow < rows &&
    value.range.endCol < cols &&
    isValidGroupLabelOffset(value.labelOffset)
  );
}

function isValidGroupLabelOffset(offset: unknown): offset is MatrixGroup["labelOffset"] {
  if (offset === undefined) {
    return true;
  }
  // CONTRACT: Bundle input is parsed JSON, so invalid optional offsets must fail closed.
  if (offset === null || typeof offset !== "object") {
    return false;
  }
  const candidate = offset as { readonly x?: unknown; readonly y?: unknown };
  return (
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y)
  );
}

function listCellFiles(bundleRoot: string): string[] {
  const dir = cellsDir(bundleRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(dir, name))
    .sort();
}

function cellFromMarkdown(
  markdown: ReturnType<typeof parse>,
  coord: { row: number; col: number },
  warnings: string[],
  filePath: string,
  bundleRoot: string,
): Cell | undefined {
  if (markdown.frontmatter.type !== "matrix_cell") {
    warnings.push(`${path.relative(bundleRoot, filePath)}: expected type matrix_cell; skipping.`);
    return undefined;
  }

  const row = readNumber(markdown.frontmatter.row, coord.row);
  const col = readNumber(markdown.frontmatter.col, coord.col);
  if (row !== coord.row || col !== coord.col) {
    warnings.push(
      `${path.relative(bundleRoot, filePath)}: frontmatter coords ${row},${col} do not match path ${coord.row},${coord.col}.`,
    );
  }

  const body = markdown.body.endsWith("\n") ? markdown.body.slice(0, -1) : markdown.body;
  return {
    value: readCellValue(markdown.frontmatter.value),
    body,
    frontmatter:
      typeof markdown.frontmatter.frontmatter_yaml === "string"
        ? markdown.frontmatter.frontmatter_yaml
        : "",
    provenance:
      typeof markdown.frontmatter.provenance === "string" && markdown.frontmatter.provenance.length > 0
        ? markdown.frontmatter.provenance
        : undefined,
  };
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function loadTemplate(
  bundleRoot: string,
  templateId: string | undefined,
  warnings: string[],
): SheetTemplate | undefined {
  if (!templateId) {
    return undefined;
  }
  try {
    assertSafeId(templateId, "templateId");
  } catch {
    warnings.push(`Invalid templateId: ${templateId}`);
    return undefined;
  }
  const filePath = templatePath(bundleRoot, templateId);
  if (!fs.existsSync(filePath)) {
    warnings.push(`Template file not found for id ${templateId}.`);
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as SheetTemplate;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Failed to parse template ${templateId}: ${message}`);
    return undefined;
  }
}
