const FRONTMATTER_DELIM = "---";

export interface MarkdownDocument {
  frontmatter: Record<string, unknown>;
  body: string;
}

export class MarkdownDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkdownDocumentError";
  }
}

const REQUIRED_FRONTMATTER_KEYS = ["type", "canvas", "group"] as const;

export function parse(text: string): MarkdownDocument {
  const lines = text.split(/\r?\n/);
  if (!lines.length || lines[0]?.trim() !== FRONTMATTER_DELIM) {
    return { frontmatter: {}, body: text };
  }

  let endIdx = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === FRONTMATTER_DELIM) {
      endIdx = index;
      break;
    }
  }
  if (endIdx < 0) {
    throw new MarkdownDocumentError("Unterminated YAML frontmatter block.");
  }

  const frontmatter = parseSimpleYaml(lines.slice(1, endIdx).join("\n"));
  let body = lines.slice(endIdx + 1).join("\n");
  if (body.startsWith("\n")) {
    body = body.slice(1);
  }
  return { frontmatter, body };
}

export function serialize(doc: MarkdownDocument): string {
  const yaml = serializeSimpleYaml(doc.frontmatter);
  const body = doc.body.endsWith("\n") || doc.body.length === 0 ? doc.body : `${doc.body}\n`;
  return `${FRONTMATTER_DELIM}\n${yaml}${FRONTMATTER_DELIM}\n\n${body}`;
}

export function validate(doc: MarkdownDocument): void {
  const missing = REQUIRED_FRONTMATTER_KEYS.filter((key) => {
    const value = doc.frontmatter[key];
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    throw new MarkdownDocumentError(`Missing required frontmatter keys: ${missing.join(", ")}`);
  }
}

function parseSimpleYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("#")) {
      index += 1;
      continue;
    }

    const keyMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!keyMatch) {
      index += 1;
      continue;
    }

    const key = keyMatch[1]!;
    const inlineValue = keyMatch[2] ?? "";
    if (inlineValue === "") {
      const next = lines[index + 1]?.trim() ?? "";
      if (next.startsWith("- ")) {
        const items: string[] = [];
        index += 1;
        while (index < lines.length && lines[index]?.trim().startsWith("- ")) {
          items.push(unquote(lines[index]!.trim().slice(2).trim()));
          index += 1;
        }
        result[key] = items;
        continue;
      }
      if (next.includes(":")) {
        const nested: Record<string, unknown> = {};
        index += 1;
        while (index < lines.length) {
          const nestedLine = lines[index];
          if (!nestedLine?.startsWith("  ")) {
            break;
          }
          const nestedMatch = /^\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(nestedLine);
          if (!nestedMatch) {
            break;
          }
          nested[nestedMatch[1]!] = parseScalar(nestedMatch[2] ?? "");
          index += 1;
        }
        result[key] = nested;
        continue;
      }
      result[key] = null;
      index += 1;
      continue;
    }

    result[key] = parseScalar(inlineValue);
    index += 1;
  }

  return result;
}

function serializeSimpleYaml(frontmatter: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${formatScalar(item)}`);
      }
      continue;
    }
    if (isPlainObject(value)) {
      lines.push(`${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        lines.push(`  ${nestedKey}: ${formatScalar(nestedValue)}`);
      }
      continue;
    }
    lines.push(`${key}: ${formatScalar(value)}`);
  }
  return `${lines.join("\n")}\n`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScalar(raw: string): unknown {
  const value = unquote(raw.trim());
  if (value === "null") {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return Number.parseFloat(value);
  }
  return value;
}

function formatScalar(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const text = String(value);
  if (/[:#\n]/.test(text) || text === "") {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
