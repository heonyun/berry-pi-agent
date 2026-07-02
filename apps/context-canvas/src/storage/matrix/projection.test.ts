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
      cellKey(0, 1),
      {
        value: null,
        body: "B1 content",
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
  const customColumnLabels = new Map([[1, "Customer"]]);
  const columnWidths = new Map([[0, 180], [2, 95]]);
  const groups = new Map([
    [
      "auto:A1:B1",
      {
        id: "auto:A1:B1",
        label: "Sample group",
        range: { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
        source: "auto" as const,
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
    groups,
    customColumnLabels,
    columnWidths,
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
    expect(result.pathsWritten).toContain("cells/0-1.md");
    expect(result.pathsWritten).toContain(MATRIX_SIDECAR);
    expect(result.pathsWritten).toContain("templates/research-default.json");
    expect(fs.existsSync(rootIndexPath(bundleRoot))).toBe(true);
    expect(fs.existsSync(sheetIndexPath(bundleRoot, MATRIX_SHEET_ID))).toBe(true);

    const manifestJson = JSON.parse(
      fs.readFileSync(path.join(bundleRoot, MATRIX_SIDECAR), "utf8"),
    );
    expect(manifestJson.customColumnLabels).toEqual([{ col: 1, label: "Customer" }]);
    expect(manifestJson.columnWidths).toEqual([
      { col: 0, width: 180 },
      { col: 2, width: 95 },
    ]);
    expect(manifestJson.groups).toEqual([...document.groups.values()]);

    const templateJson = JSON.parse(
      fs.readFileSync(path.join(bundleRoot, "templates", `${RESEARCH_SHEET_TEMPLATE.id}.json`), "utf8"),
    );
    expect(templateJson.id).toBe(RESEARCH_SHEET_TEMPLATE.id);

    const cellMarkdown = parse(fs.readFileSync(cellCoordToPath(bundleRoot, 0, 0), "utf8"));
    expect(cellMarkdown.frontmatter.type).toBe("matrix_cell");
    expect(cellMarkdown.frontmatter.row).toBe(0);
    expect(cellMarkdown.frontmatter.col).toBe(0);
    expect(cellMarkdown.frontmatter.value).toBe("A1");
    expect(cellMarkdown.frontmatter.provenance).toBe("user");
    expect(cellMarkdown.frontmatter.frontmatter_yaml).toBe("status: draft");
    expect(cellMarkdown.body.trimEnd()).toBe("Cell A1 body");
  });

  it("writes matrix sidecar for legacy documents without groups", () => {
    const bundleRoot = makeTempDir();
    const document = {
      ...sampleMatrixDocument(),
      groups: undefined,
    } as unknown as MatrixDocument;

    const result = projectMatrixToBundle(document, bundleRoot);

    expect(result.errors).toEqual([]);
    const manifestJson = JSON.parse(
      fs.readFileSync(path.join(bundleRoot, MATRIX_SIDECAR), "utf8"),
    );
    expect(manifestJson.groups).toEqual([]);
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

  it("ignores invalid column width manifest entries", () => {
    const bundleRoot = makeTempDir();
    projectMatrixToBundle(sampleMatrixDocument(), bundleRoot);
    const sidecarPath = path.join(bundleRoot, MATRIX_SIDECAR);
    const manifest = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    manifest.columnWidths = [
      ...manifest.columnWidths,
      { col: -1, width: 100 },
      { col: manifest.cols, width: 100 },
      { col: 1, width: "wide" },
    ];
    fs.writeFileSync(sidecarPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const loaded = loadMatrixBundle(bundleRoot);
    expect(loaded.document?.columnWidths).toEqual(new Map([[0, 180], [2, 95]]));
  });

  it("ignores invalid custom column label manifest entries", () => {
    const bundleRoot = makeTempDir();
    projectMatrixToBundle(sampleMatrixDocument(), bundleRoot);
    const sidecarPath = path.join(bundleRoot, MATRIX_SIDECAR);
    const manifest = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    manifest.customColumnLabels = [
      { col: 1, label: "Customer" },
      { col: -1, label: "Negative" },
      { col: manifest.cols, label: "Out of range" },
      { col: 2, label: "   " },
      { col: 3, label: 123 },
    ];
    fs.writeFileSync(sidecarPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const loaded = loadMatrixBundle(bundleRoot);
    expect(loaded.document?.customColumnLabels).toEqual(new Map([[1, "Customer"]]));
  });

  it("ignores invalid group manifest entries", () => {
    const bundleRoot = makeTempDir();
    projectMatrixToBundle(sampleMatrixDocument(), bundleRoot);
    const sidecarPath = path.join(bundleRoot, MATRIX_SIDECAR);
    const manifest = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    manifest.groups = [
      ...manifest.groups,
      { id: "", label: "Bad", source: "auto", range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 } },
      { id: "bad", label: "Bad", source: "auto", range: { startRow: -1, startCol: 0, endRow: 0, endCol: 0 } },
    ];
    fs.writeFileSync(sidecarPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const loaded = loadMatrixBundle(bundleRoot);

    expect(loaded.document?.groups.size).toBe(1);
    expect(loaded.document?.groups.get("auto:A1:B1")?.label).toBe("Sample group");
  });

  it("detects groups when loading a legacy manifest without groups", () => {
    const bundleRoot = makeTempDir();
    projectMatrixToBundle(sampleMatrixDocument(), bundleRoot);
    const sidecarPath = path.join(bundleRoot, MATRIX_SIDECAR);
    const manifest = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    delete manifest.groups;
    fs.writeFileSync(sidecarPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const loaded = loadMatrixBundle(bundleRoot);

    expect(loaded.document?.groups.size).toBe(1);
    expect(loaded.document?.groups.get("auto:A1:B1")?.label).toBe("Cell A1 body");
  });

  it("reports forward-slash bundle-relative paths from projection", () => {
    const bundleRoot = makeTempDir();
    const result = projectMatrixToBundle(sampleMatrixDocument(), bundleRoot);
    expect(result.pathsWritten.every((entry) => !entry.includes("\\"))).toBe(true);
    expect(result.pathsWritten).toContain("sheet/sheet-main/index.md");
  });

  it("warns and skips template files with unsafe templateId values", () => {
    const bundleRoot = makeTempDir();
    projectMatrixToBundle(sampleMatrixDocument(), bundleRoot);
    const sidecarPath = path.join(bundleRoot, MATRIX_SIDECAR);
    const manifest = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    manifest.templateId = "../escape";
    fs.writeFileSync(sidecarPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const loaded = loadMatrixBundle(bundleRoot);
    expect(loaded.warnings.some((warning) => warning.includes("Invalid templateId"))).toBe(true);
    expect(loaded.document?.template).toBeUndefined();
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

  it("rejects negative cell coordinates during export", () => {
    const bundleRoot = makeTempDir();
    const document = sampleMatrixDocument();
    const cells = new Map(document.sheet.cells);
    cells.set("-1,0", {
      value: null,
      body: "negative row",
      frontmatter: "",
    });
    cells.set("0,-2", {
      value: null,
      body: "negative col",
      frontmatter: "",
    });

    const result = projectMatrixToBundle(
      {
        ...document,
        sheet: { ...document.sheet, cells },
      },
      bundleRoot,
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_cell_key", message: expect.stringContaining("-1,0") }),
        expect.objectContaining({ code: "invalid_cell_key", message: expect.stringContaining("0,-2") }),
      ]),
    );
    expect(result.pathsWritten.some((entry) => entry.includes("cells/-"))).toBe(false);
  });

  it("rejects out-of-range cell coordinates during export", () => {
    const bundleRoot = makeTempDir();
    const document = sampleMatrixDocument();
    const cells = new Map(document.sheet.cells);
    cells.set(cellKey(0, document.sheet.cols), {
      value: null,
      body: "past last column",
      frontmatter: "",
    });
    cells.set(cellKey(document.sheet.rows, 0), {
      value: null,
      body: "past last row",
      frontmatter: "",
    });

    const result = projectMatrixToBundle(
      {
        ...document,
        sheet: { ...document.sheet, cells },
      },
      bundleRoot,
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "out_of_range_cell" }),
        expect.objectContaining({ code: "out_of_range_cell" }),
      ]),
    );
  });
});
