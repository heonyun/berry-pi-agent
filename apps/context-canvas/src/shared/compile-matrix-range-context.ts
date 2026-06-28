import {
  cellKey,
  formatColumnLabel,
  formatRangeLabel,
  type MatrixDocument,
  type RangeRefDTO,
} from "./domain.ts";

export interface CompiledRangeContext {
  readonly contextRangeLabels: string[];
  readonly targetRangeLabel: string;
  readonly contextText: string;
  readonly messages: Array<{ role: "system" | "user"; content: string }>;
}

/** One context rectangle with a display label (named range or A1 notation). */
export interface MatrixContextRange {
  readonly label: string;
  readonly range: RangeRefDTO;
}

const MATRIX_AI_SYSTEM_PROMPT = `You are a matrix AI assistant. Respond with ONLY valid JSON matching this schema:
{
  "intent": string,
  "targetRange": { "startRow": number, "startCol": number, "endRow": number, "endCol": number },
  "patches": [{ "row": number, "col": number, "value": string|number|boolean|null, "body": string, "frontmatter"?: string, "provenance"?: string }]
}
All patch coordinates must fall within targetRange. Do not include markdown fences.`;

function extractRangeCellLines(document: MatrixDocument, range: RangeRefDTO): string[] {
  const lines: string[] = [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      const cell = document.sheet.cells.get(cellKey(row, col));
      if (!cell || (!cell.body && cell.value === null)) {
        continue;
      }
      const address = `${formatColumnLabel(col)}${row + 1}`;
      const display = cell.body || String(cell.value);
      lines.push(`  ${address}: ${display}`);
      if (cell.frontmatter?.trim()) {
        lines.push(`    frontmatter: ${cell.frontmatter.trim()}`);
      }
    }
  }
  return lines;
}

function renderContextBlock(label: string, range: RangeRefDTO, lines: string[]): string {
  const rangeLabel = formatRangeLabel(
    range.startCol,
    range.startRow,
    range.endCol,
    range.endRow,
  );
  const header = `## ${label} (${rangeLabel})`;
  if (lines.length === 0) {
    return `${header}\n  (empty range)`;
  }
  return `${header}\n${lines.join("\n")}`;
}

/**
 * Compile structured context from context ranges and a target range for matrix-run.
 * Mirrors compileQABlockContext output shape (messages + contextText).
 */
export function compileMatrixRangeContext(
  document: MatrixDocument,
  contextRanges: readonly MatrixContextRange[],
  targetRange: RangeRefDTO,
  userPrompt: string,
): CompiledRangeContext {
  const blocks = contextRanges.map((entry) =>
    renderContextBlock(entry.label, entry.range, extractRangeCellLines(document, entry.range)),
  );

  const targetRangeLabel = formatRangeLabel(
    targetRange.startCol,
    targetRange.startRow,
    targetRange.endCol,
    targetRange.endRow,
  );

  const contextRangeLabels =
    contextRanges.length > 0
      ? contextRanges.map((entry) => {
          const rangeLabel = formatRangeLabel(
            entry.range.startCol,
            entry.range.startRow,
            entry.range.endCol,
            entry.range.endRow,
          );
          return `${entry.label} (${rangeLabel})`;
        })
      : ["(no context ranges)"];

  const contextText = blocks.length > 0 ? blocks.join("\n\n") : "(no context ranges)";

  return {
    contextRangeLabels,
    targetRangeLabel,
    contextText,
    messages: [
      { role: "system", content: MATRIX_AI_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Target range: ${targetRangeLabel}`,
          "",
          "Context ranges:",
          contextText,
          "",
          `User intent: ${userPrompt}`,
        ].join("\n"),
      },
    ],
  };
}

/** @deprecated Phase 1 stub — use compileMatrixRangeContext. Kept for backward-compatible tests. */
export function compileMatrixRangeContextStub(
  document: MatrixDocument,
  targetRange: RangeRefDTO,
  userPrompt: string,
  contextRangeNames: string[] = [],
): CompiledRangeContext {
  const label =
    contextRangeNames[0] ??
    formatRangeLabel(
      targetRange.startCol,
      targetRange.startRow,
      targetRange.endCol,
      targetRange.endRow,
    );
  return compileMatrixRangeContext(
    document,
    [{ label, range: targetRange }],
    targetRange,
    userPrompt,
  );
}
