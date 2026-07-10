import { formatRangeLabel, type MatrixDocument, type RangeRefDTO } from "./domain.ts";

export interface CellReferenceFormula {
  readonly label: string;
  readonly range: RangeRefDTO;
  readonly groupId?: string;
}

function parseColumnLabel(label: string): number | null {
  if (!/^[A-Z]+$/.test(label)) {
    return null;
  }
  let col = 0;
  for (const char of label) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }
  return col - 1;
}

function parseCellAddress(address: string): { readonly row: number; readonly col: number } | null {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(address.trim().toUpperCase());
  if (!match) {
    return null;
  }
  const col = parseColumnLabel(match[1] ?? "");
  const row = Number(match[2]) - 1;
  if (col === null || !Number.isInteger(row)) {
    return null;
  }
  return { row, col };
}

function parseA1Reference(token: string, document: MatrixDocument): CellReferenceFormula | null {
  const parts = token.split(":");
  if (parts.length > 2) {
    return null;
  }
  const startToken = parts[0];
  const endToken = parts[1] ?? startToken;
  if (!startToken || !endToken) {
    return null;
  }
  const start = parseCellAddress(startToken);
  const end = parseCellAddress(endToken);
  if (!start || !end) {
    return null;
  }
  const range: RangeRefDTO = {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
  if (
    range.startRow < 0 ||
    range.startCol < 0 ||
    range.endRow >= document.sheet.rows ||
    range.endCol >= document.sheet.cols
  ) {
    return null;
  }
  return {
    label: formatRangeLabel(range.startCol, range.startRow, range.endCol, range.endRow),
    range,
  };
}

function findNamedRangeByFormulaToken(
  document: MatrixDocument,
  token: string,
): CellReferenceFormula | null {
  const normalized = token.slice(1).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  for (const named of document.namedRanges.values()) {
    if (named.name.trim().toLowerCase() === normalized) {
      return { label: `@${named.name}`, range: named.range };
    }
  }
  return null;
}

export function resolveCellReferenceFormula(
  document: MatrixDocument,
  body: string,
): CellReferenceFormula | null {
  if (!body.startsWith("=") || body === "=") {
    return null;
  }
  const token = body.slice(1).trim();
  if (!token) {
    return null;
  }

  const a1Reference = parseA1Reference(token, document);
  if (a1Reference) {
    return a1Reference;
  }

  if (token.startsWith("@")) {
    return findNamedRangeByFormulaToken(document, token);
  }

  const matchingGroups = [...document.groups.values()].filter(
    (group) => !group.dismissed && group.label.trim() === token,
  );
  if (matchingGroups.length !== 1) {
    return null;
  }
  const [group] = matchingGroups;
  return { label: group.label, range: group.range, groupId: group.id };
}

export function shouldSuppressInlineCommitRun(document: MatrixDocument, body: string): boolean {
  if (body === "=") {
    return true;
  }
  return resolveCellReferenceFormula(document, body) !== null;
}
