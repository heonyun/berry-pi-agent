// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseCellFrontmatter, formatStatusChip } from "./matrix-frontmatter.ts";

describe("parseCellFrontmatter", () => {
  it("extracts status from simple YAML", () => {
    const parsed = parseCellFrontmatter("status: draft\ntags: [a, b]");
    expect(parsed.status).toBe("draft");
    expect(parsed.tags).toBe("[a, b]");
  });

  it("handles quoted status values", () => {
    const parsed = parseCellFrontmatter('status: "in review"');
    expect(parsed.status).toBe("in review");
  });

  it("returns empty object for blank frontmatter", () => {
    expect(parseCellFrontmatter("")).toEqual({});
    expect(parseCellFrontmatter("  \n  ")).toEqual({});
  });
});

describe("formatStatusChip", () => {
  it("wraps status in brackets", () => {
    expect(formatStatusChip("draft")).toBe("[draft]");
  });
});
