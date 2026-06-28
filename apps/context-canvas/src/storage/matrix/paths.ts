import path from "node:path";

export const CELLS_DIR = "cells";
export const SHEET_DIR = "sheet";
export const TEMPLATES_DIR = "templates";
export const HISTORY_DIR = "history";
export const HISTORY_RUNS_FILE = "runs.json";
export const MATRIX_SIDECAR = "matrix.sidecar.json";
export const ROOT_INDEX = "index.md";

const SAFE_COORD_RE = /^\d+-\d+$/;

export class MatrixBundlePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatrixBundlePathError";
  }
}

function normalizeForBundleRootCheck(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/");
}

export function resolveWithinBundle(bundleRoot: string, ...segments: string[]): string {
  const resolved = path.resolve(bundleRoot, ...segments);
  const root = path.resolve(bundleRoot);
  const normalizedResolved = normalizeForBundleRootCheck(resolved);
  const normalizedRoot = normalizeForBundleRootCheck(root);
  if (normalizedResolved !== normalizedRoot && !normalizedResolved.startsWith(`${normalizedRoot}/`)) {
    throw new MatrixBundlePathError(`Path escapes bundle root: ${resolved}`);
  }
  return resolved;
}

export function normalizeBundleRelativePath(bundleRoot: string, targetPath: string): string {
  const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.resolve(bundleRoot, targetPath);
  return path.relative(bundleRoot, absolutePath).split(path.sep).join("/");
}

export function cellCoordToFilename(row: number, col: number): string {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) {
    throw new MatrixBundlePathError(`Invalid cell coordinates: ${row},${col}`);
  }
  return `${row}-${col}.md`;
}

export function cellCoordToPath(bundleRoot: string, row: number, col: number): string {
  const filename = cellCoordToFilename(row, col);
  if (!SAFE_COORD_RE.test(filename.slice(0, -3))) {
    throw new MatrixBundlePathError(`Invalid cell filename: ${filename}`);
  }
  return resolveWithinBundle(bundleRoot, CELLS_DIR, filename);
}

export function pathToCellCoord(bundleRoot: string, filePath: string): { row: number; col: number } | undefined {
  const relative = path.relative(bundleRoot, filePath);
  const match = /^cells[/\\](\d+)-(\d+)\.md$/.exec(relative);
  if (!match) {
    return undefined;
  }
  return {
    row: Number.parseInt(match[1]!, 10),
    col: Number.parseInt(match[2]!, 10),
  };
}

export function sheetIndexPath(bundleRoot: string, sheetId: string): string {
  return resolveWithinBundle(bundleRoot, SHEET_DIR, sheetId, ROOT_INDEX);
}

export function templatePath(bundleRoot: string, templateId: string): string {
  return resolveWithinBundle(bundleRoot, TEMPLATES_DIR, `${templateId}.json`);
}

export function matrixSidecarPath(bundleRoot: string): string {
  return path.join(bundleRoot, MATRIX_SIDECAR);
}

export function rootIndexPath(bundleRoot: string): string {
  return path.join(bundleRoot, ROOT_INDEX);
}

export function cellsDir(bundleRoot: string): string {
  return path.join(bundleRoot, CELLS_DIR);
}

export function historyRunsPath(bundleRoot: string): string {
  return resolveWithinBundle(bundleRoot, HISTORY_DIR, HISTORY_RUNS_FILE);
}
