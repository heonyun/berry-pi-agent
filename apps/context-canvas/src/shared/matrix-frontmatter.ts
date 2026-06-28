import type { CellFrontmatterParsed } from "./domain.ts";

/** Parse simple YAML frontmatter for status chip display (no full YAML engine). */
export function parseCellFrontmatter(frontmatter: string): CellFrontmatterParsed {
  const result: Record<string, unknown> = {};
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon <= 0) {
      continue;
    }
    const key = trimmed.slice(0, colon).trim();
    let value: unknown = trimmed.slice(colon + 1).trim();
    if (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (typeof value === "string" && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function formatStatusChip(status: string): string {
  return `[${status}]`;
}
