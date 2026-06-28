// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cellKey,
  createEmptyMatrixDocument,
  MATRIX_SHEET_ID,
  type MatrixHistoryEntry,
} from "../../shared/domain.ts";
import { readMatrixHistory, writeMatrixHistory } from "./history.ts";
import { loadMatrixBundle } from "./load.ts";
import { historyRunsPath } from "./paths.ts";
import { projectMatrixToBundle } from "./project.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "matrix-history-"));
  tempDirs.push(dir);
  return dir;
}

function sampleHistoryEntry(): MatrixHistoryEntry {
  return {
    id: "hist-test-1",
    timestamp: "2026-06-28T12:00:00.000Z",
    intent: "Summarize inputs into outputs",
    contextRangeNames: ["@inputs"],
    contextRanges: [
      { label: "@inputs", range: { startRow: 0, startCol: 0, endRow: 4, endCol: 0 } },
    ],
    targetRangeLabel: "@outputs",
    targetRange: { startRow: 0, startCol: 4, endRow: 4, endCol: 4 },
    patchesApplied: 3,
    compiledContextPreview: "context preview",
    patchesSummary: "E1, E2, E3",
  };
}

function sampleDocument() {
  const document = createEmptyMatrixDocument({ withResearchTemplate: false });
  const cells = new Map(document.sheet.cells);
  cells.set(cellKey(0, 0), { value: "A1", body: "Cell A1", frontmatter: "", provenance: "user" });
  return {
    ...document,
    sheet: { ...document.sheet, id: MATRIX_SHEET_ID, name: "Test Matrix", cells },
  };
}

describe("matrix history storage", () => {
  it("writes and reads history/runs.json", () => {
    const bundleRoot = makeTempDir();
    const entry = sampleHistoryEntry();

    const relative = writeMatrixHistory(bundleRoot, [entry]);
    expect(relative).toBe("history/runs.json");
    expect(fs.existsSync(historyRunsPath(bundleRoot))).toBe(true);

    const loaded = readMatrixHistory(bundleRoot);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.intent).toBe(entry.intent);
    expect(loaded[0]?.patchesApplied).toBe(3);
  });

  it("round-trips history with bundle projection", () => {
    const bundleRoot = makeTempDir();
    const document = sampleDocument();
    const history = [sampleHistoryEntry()];

    const projectResult = projectMatrixToBundle(document, bundleRoot, { historyEntries: history });
    expect(projectResult.errors).toEqual([]);
    expect(projectResult.pathsWritten).toContain("history/runs.json");

    const loadResult = loadMatrixBundle(bundleRoot);
    expect(loadResult.errors).toEqual([]);
    expect(loadResult.history).toHaveLength(1);
    expect(loadResult.history?.[0]?.patchesSummary).toBe("E1, E2, E3");
  });

  it("clears history/runs.json when an empty history array is exported", () => {
    const bundleRoot = makeTempDir();
    const document = sampleDocument();
    const history = [sampleHistoryEntry()];

    projectMatrixToBundle(document, bundleRoot, { historyEntries: history });
    expect(readMatrixHistory(bundleRoot)).toHaveLength(1);

    projectMatrixToBundle(document, bundleRoot, { historyEntries: [] });
    expect(readMatrixHistory(bundleRoot)).toEqual([]);
  });
});
