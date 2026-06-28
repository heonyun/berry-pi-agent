import type { CellValue, MatrixDocument, MatrixHistoryEntry, NamedRange } from "../../shared/domain.ts";

/** On-disk bundle layout manifest (Phase 4a data contract). */
export interface MatrixBundleManifest {
  readonly kind: "matrix-bundle";
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly workspaceTitle: string;
  readonly sheetId: string;
  readonly sheetName: string;
  readonly rows: number;
  readonly cols: number;
  readonly namedRanges: NamedRange[];
  readonly templateId?: string;
}

export interface MatrixCellProjectionFrontmatter {
  type: "matrix_cell";
  row: number;
  col: number;
  value?: CellValue;
  provenance?: string;
  frontmatter_yaml?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface ProjectionError {
  code: string;
  message: string;
  path?: string;
}

export interface ProjectResult {
  pathsWritten: string[];
  errors: ProjectionError[];
}

export interface LoadResult {
  document?: MatrixDocument;
  history?: MatrixHistoryEntry[];
  warnings: string[];
  errors: string[];
}

/** On-disk history file (`history/runs.json`). */
export interface MatrixHistoryRunsFile {
  readonly kind: "matrix-history";
  readonly schemaVersion: 1;
  readonly entries: MatrixHistoryEntry[];
}

export interface ProjectOptions {
  workspaceId?: string;
  workspaceTitle?: string;
  writeMatrixSidecar?: boolean;
  historyEntries?: readonly MatrixHistoryEntry[];
}
