// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cellKey,
  createEmptyMatrixDocument,
  MATRIX_SHEET_ID,
  RESEARCH_SHEET_TEMPLATE,
  type MatrixDocument,
} from "../../shared/domain.ts";
import { parse } from "../markdown/document.ts";
import { loadMatrixBundle } from "./load.ts";
import {
  cellCoordToPath,
  normalizeBundleRelativePath,
  rootIndexPath,
  sheetIndexPath,
} from "./paths.ts";
import { projectMatrixToBundle } from "./project.ts";
import { MATRIX_SIDECAR } from "./sidecar.ts";

function sampleMatrixDocument(): MatrixDocument {
  const cells = new Map([
    [
      cellKey(0, 0),
      {
        value: "A1",
        body: "Cell A1 body",
        frontmatter: "status: draft",
        provenance: "user",
      },
    ],
    [
      cellKey(1, 2),
      {
        value: null,
        body: "C2 content",
        frontmatter: "",
      },
    ],
  ]);
  const namedRanges = new Map([
    [
      "outputs",
      {
        name: "outputs",
        range: { startRow: 0, startCol: 4, endRow: 4, endCol: 4 },
        role: "target" as const,
      },
    ],
  ]);

  return {
    kind: "matrix",
    schemaVersion: 4,
    sheet: {
      id: MATRIX_SHEET_ID,
      name: "Test Matrix",
      rows: 20,
      cols: 50,
      cells,
    },
    namedRanges,
    templateId: RESEARCH_SHEET_TEMPLATE.id,
    template: RESEARCH_SHEET_TEMPLATE,
  };
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "matrix-bundle-"));
  tempDirs.push(dir);
  return dir;
}

describe("projectMatrixToBundle", () => {
  it("writes sparse cell markdown, indexes, and matrix sidecar", () => {
    const bundleRoot = makeTempDir();
    const document = sampleMatrixDocument();
    const result = projectMatrixToBundle(document, bundleRoot);

    expect(result.errors).toEqual([]);
    expect(result.pathsWritten).toContain("cells/0-0.md");
    expect(result.pathsWritten).toContain("cells/1-2.md");
    expect(result.pathsWritten).toContain(MATRIX_SIDECAR);
    expect(result.pathsWritten).toContain("templates/research-default.json");
    expect(fs.existsSync(rootIndexPath(bundleRoot))).toBe(true);
    expect(fs.existsSync(sheetIndexPath(bundleRoot, MATRIX_SHEET_ID))).toBe(true);

    const cellMarkdown = parse(fs.readFileSync(cellCoordToPath(bundleRoot, 0, 0), "utf8"));
    expect(cellMarkdown.frontmatter.type).toBe("matrix_cell");
    expect(cellMarkdown.frontmatter.row).toBe(0);
    expect(cellMarkdown.frontmatter.col).toBe(0);
    expect(cellMarkdown.frontmatter.value).toBe("A1");
    expect(cellMarkdown.frontmatter.provenance).toBe("user");
    expect(cellMarkdown.frontmatter.frontmatter_yaml).toBe("status: draft");
    expect(cellMarkdown.body.trimEnd()).toBe("Cell A1 body");
  });

  it("omits cell files for empty sparse map entries", () => {
    const bundleRoot = makeTempDir();
    const document = createEmptyMatrixDocument({ withResearchTemplate: false });
    const result = projectMatrixToBundle(document, bundleRoot);

    expect(result.pathsWritten.some((entry) => entry.startsWith("cells/"))).toBe(false);
  });
});

describe("loadMatrixBundle", () => {
  it("round-trips MatrixDocument without cell loss", () => {
    const bundleRoot = makeTempDir();
    const document = sampleMatrixDocument();
    projectMatrixToBundle(document, bundleRoot);

    const loaded = loadMatrixBundle(bundleRoot);
    expect(loaded.errors).toEqual([]);
    expect(loaded.document).toEqual(document);
  });

  it("loads named ranges from manifest", () => {
    const bundleRoot = makeTempDir();
    const document = sampleMatrixDocument();
    projectMatrixToBundle(document, bundleRoot);

    const loaded = loadMatrixBundle(bundleRoot);
    expect(loaded.document?.namedRanges.get("outputs")).toEqual({
      name: "outputs",
      range: { startRow: 0, startCol: 4, endRow: 4, endCol: 4 },
      role: "target",
    });
  });

  it("reports forward-slash bundle-relative paths from projection", () => {
    const bundleRoot = makeTempDir();
    const result = projectMatrixToBundle(sampleMatrixDocument(), bundleRoot);
    expect(result.pathsWritten.every((entry) => !entry.includes("\\"))).toBe(true);
    expect(result.pathsWritten).toContain("sheet/sheet-main/index.md");
  });
});

describe("normalizeBundleRelativePath", () => {
  it("uses forward slashes for bundle-relative paths", () => {
    const bundleRoot = makeTempDir();
    const absolutePath = path.join(bundleRoot, "cells", "0-0.md");
    expect(normalizeBundleRelativePath(bundleRoot, absolutePath)).toBe("cells/0-0.md");
  });
});

describe("bundle path safety", () => {
  it("rejects invalid cell coordinates during export", () => {
    const bundleRoot = makeTempDir();
    const document = sampleMatrixDocument();
    const cells = new Map(document.sheet.cells);
    cells.set("bad-key", {
      value: null,
      body: "orphan",
      frontmatter: "",
    });

    const result = projectMatrixToBundle(
      {
        ...document,
        sheet: { ...document.sheet, cells },
      },
      bundleRoot,
    );

    expect(result.errors.some((error) => error.code === "invalid_cell_key")).toBe(true);
  });
});
