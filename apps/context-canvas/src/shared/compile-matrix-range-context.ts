import {
  cellKey,
  formatColumnLabel,
  formatRangeLabel,
  type MatrixDocument,
  type RangeRefDTO,
} from "./domain.ts";

/** Phase 1 stub — full compile lands in Phase 2. */
export interface CompiledRangeContext {
  readonly contextRangeLabels: string[];
  readonly targetRangeLabel: string;
  readonly contextText: string;
  readonly messages: Array<{ role: "system" | "user"; content: string }>;
}

const MATRIX_AI_SYSTEM_PROMPT = `You are a matrix AI assistant. Respond with ONLY valid JSON matching this schema:
{
  "intent": string,
  "targetRange": { "startRow": number, "startCol": number, "endRow": number, "endCol": number },
  "patches": [{ "row": number, "col": number, "value": string|number|boolean|null, "body": string, "frontmatter"?: string, "provenance"?: string }]
}
All patch coordinates must fall within targetRange. Do not include markdown fences.`;

/** Minimal compile: selected range cells as plain text lines. */
export function compileMatrixRangeContextStub(
  document: MatrixDocument,
  targetRange: RangeRefDTO,
  userPrompt: string,
  contextRangeNames: string[] = [],
): CompiledRangeContext {
  const lines: string[] = [];
  for (let row = targetRange.startRow; row <= targetRange.endRow; row++) {
    for (let col = targetRange.startCol; col <= targetRange.endCol; col++) {
      const cell = document.sheet.cells.get(cellKey(row, col));
      if (cell && (cell.body || cell.value !== null)) {
        const label = `${formatColumnLabel(col)}${row + 1}`;
        const value = cell.body || String(cell.value);
        lines.push(`${label}: ${value}`);
      }
    }
  }

  const targetRangeLabel = formatRangeLabel(
    targetRange.startCol,
    targetRange.startRow,
    targetRange.endCol,
    targetRange.endRow,
  );
  const contextText = lines.length > 0 ? lines.join("\n") : "(empty range)";

  return {
    contextRangeLabels: contextRangeNames.length > 0 ? contextRangeNames : [targetRangeLabel],
    targetRangeLabel,
    contextText,
    messages: [
      { role: "system", content: MATRIX_AI_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Target range: ${targetRangeLabel}\n\nContext:\n${contextText}\n\nUser intent: ${userPrompt}`,
      },
    ],
  };
}
