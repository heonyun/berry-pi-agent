export { loadMatrixBundle } from "./load.ts";
export { regenerateMatrixIndexes } from "./index.ts";
export { projectMatrixToBundle, DEFAULT_MATRIX_WORKSPACE_ID } from "./project.ts";
export { readMatrixHistory, writeMatrixHistory } from "./history.ts";
export { readMatrixManifest, writeMatrixManifest, buildMatrixManifest, MATRIX_SIDECAR } from "./sidecar.ts";
export type {
  LoadResult,
  MatrixBundleManifest,
  MatrixCellProjectionFrontmatter,
  ProjectOptions,
  ProjectResult,
  ProjectionError,
} from "./types.ts";
