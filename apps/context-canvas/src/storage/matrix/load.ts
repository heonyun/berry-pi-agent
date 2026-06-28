import fs from "node:fs";
import path from "node:path";
import type { Cell, CellValue, MatrixDocument, SheetTemplate } from "../../shared/domain.ts";
import { cellKey } from "../../shared/domain.ts";
import { parse } from "../markdown/document.ts";
import { assertSafeId } from "../markdown/paths.ts";
import { cellsDir, pathToCellCoord } from "./paths.ts";
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
    ...(manifest.templateId ? { templateId: manifest.templateId } : {}),
    ...(template ? { template } : {}),
  };

  if (errors.length > 0) {
    return { warnings, errors };
  }

  return { document, warnings, errors };
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
