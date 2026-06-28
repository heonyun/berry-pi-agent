import fs from "node:fs";
import path from "node:path";
import type { MatrixDocument } from "../../shared/domain.ts";
import { formatRangeLabel } from "../../shared/domain.ts";
import { serialize } from "../markdown/document.ts";
import { normalizeBundleRelativePath, rootIndexPath, sheetIndexPath } from "./paths.ts";

export function regenerateMatrixIndexes(bundleRoot: string, document: MatrixDocument): string[] {
  const written: string[] = [];

  const sheetPath = sheetIndexPath(bundleRoot, document.sheet.id);
  fs.mkdirSync(path.dirname(sheetPath), { recursive: true });
  fs.writeFileSync(sheetPath, buildSheetIndexText(document), "utf8");
  written.push(normalizeBundleRelativePath(bundleRoot, sheetPath));

  const rootPath = rootIndexPath(bundleRoot);
  fs.writeFileSync(rootPath, buildRootIndexText(document), "utf8");
  written.push(normalizeBundleRelativePath(bundleRoot, rootPath));

  return written;
}

function buildRootIndexText(document: MatrixDocument): string {
  const cellCount = document.sheet.cells.size;
  const lines = [
    `# ${document.sheet.name}`,
    "",
    `Workspace kind: \`matrix\``,
    `Sheet: \`${document.sheet.id}\` (${document.sheet.rows}×${document.sheet.cols})`,
    `Populated cells: ${cellCount}`,
    "",
    "# Navigation",
    "",
    `* [Sheet index](${path.posix.join("sheet", document.sheet.id, "index.md")})`,
    "",
    "# Cells",
    "",
    ...[...document.sheet.cells.entries()]
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, cell]) => {
        const [row, col] = key.split(",").map((part) => Number.parseInt(part, 10));
        const label = formatRangeLabel(col, row, col, row);
        const summary = cell.body.trim().split("\n")[0] || "(empty body)";
        return `* [${label}](${path.posix.join("cells", `${row}-${col}.md`)}) — ${summary}`;
      }),
    "",
  ];
  return `${lines.join("\n").trim()}\n`;
}

function buildSheetIndexText(document: MatrixDocument): string {
  const namedRangeLines =
    document.namedRanges.size === 0
      ? ["(none)", ""]
      : [
          "| Name | Range | Role |",
          "| --- | --- | --- |",
          ...[...document.namedRanges.values()].map((entry) => {
            const { range, role } = entry;
            const label = formatRangeLabel(
              range.startCol,
              range.startRow,
              range.endCol,
              range.endRow,
            );
            return `| ${entry.name} | ${label} | ${role ?? ""} |`;
          }),
          "",
        ];

  const bodyLines = [
    `# ${document.sheet.name}`,
    "",
    `Sheet ID: \`${document.sheet.id}\``,
    `Dimensions: ${document.sheet.rows} rows × ${document.sheet.cols} cols`,
    "",
    "# Named Ranges",
    "",
    ...namedRangeLines,
    "# Populated Cells",
    "",
    ...[...document.sheet.cells.entries()]
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, cell]) => {
        const [row, col] = key.split(",").map((part) => Number.parseInt(part, 10));
        const label = formatRangeLabel(col, row, col, row);
        const summary = cell.body.trim().split("\n")[0] || "(empty body)";
        return `* [${label}](${path.posix.join("..", "..", "cells", `${row}-${col}.md`)}) — ${summary}`;
      }),
    "",
  ];

  return serialize({
    frontmatter: {
      type: "matrix_sheet",
      sheet: document.sheet.id,
      title: document.sheet.name,
      rows: document.sheet.rows,
      cols: document.sheet.cols,
      template_id: document.templateId,
      cell_count: document.sheet.cells.size,
      named_range_count: document.namedRanges.size,
    },
    body: bodyLines.join("\n"),
  });
}
