import fs from "node:fs";
import path from "node:path";
import type { MatrixHistoryEntry } from "../../shared/domain.ts";
import { isMatrixHistoryEntry } from "../../shared/matrix-validation.ts";
import { HISTORY_DIR, historyRunsPath } from "./paths.ts";
import type { MatrixHistoryRunsFile } from "./types.ts";

export function writeMatrixHistory(
  bundleRoot: string,
  entries: readonly MatrixHistoryEntry[],
): string {
  const filePath = historyRunsPath(bundleRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload: MatrixHistoryRunsFile = {
    kind: "matrix-history",
    schemaVersion: 1,
    entries: [...entries],
  };
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path.relative(bundleRoot, filePath).split(path.sep).join("/");
}

export function readMatrixHistory(bundleRoot: string): MatrixHistoryEntry[] {
  const filePath = historyRunsPath(bundleRoot);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as MatrixHistoryRunsFile;
    if (parsed?.kind !== "matrix-history" || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) {
      return [];
    }
    return parsed.entries.filter(isMatrixHistoryEntry);
  } catch {
    return [];
  }
}
