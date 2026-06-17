// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MarkdownDocumentError, parse, serialize, validate } from "./document.ts";

describe("markdown document", () => {
  it("round-trips frontmatter and body", () => {
    const source = {
      frontmatter: {
        type: "prompt_input",
        canvas: "canvas-1",
        group: "group-1",
        position: { x: 0, y: -240 },
        context_refs: ["answer-1"],
        lineage_parent: null,
      },
      body: "Hello\n\n# Lineage\n\nParent link\n",
    };

    const parsed = parse(serialize(source));
    expect(parsed.frontmatter.type).toBe("prompt_input");
    expect(parsed.frontmatter.canvas).toBe("canvas-1");
    expect(parsed.frontmatter.group).toBe("group-1");
    expect(parsed.frontmatter.position).toEqual({ x: 0, y: -240 });
    expect(parsed.frontmatter.context_refs).toEqual(["answer-1"]);
    expect(parsed.frontmatter.lineage_parent).toBeNull();
    expect(parsed.body).toContain("Hello");
    expect(parsed.body).toContain("# Lineage");
  });

  it("round-trips empty arrays and null lineage", () => {
    const source = {
      frontmatter: {
        type: "prompt_input",
        canvas: "canvas-1",
        group: "group-1",
        position: { x: 0, y: 0 },
        context_refs: [],
        lineage_parent: null,
      },
      body: "Empty refs\n",
    };

    const parsed = parse(serialize(source));
    expect(parsed.frontmatter.context_refs).toEqual([]);
    expect(parsed.frontmatter.lineage_parent).toBeNull();
  });

  it("validates required frontmatter keys", () => {
    expect(() => validate({ frontmatter: { type: "prompt_input" }, body: "" })).toThrow(
      MarkdownDocumentError,
    );
    expect(() =>
      validate({ frontmatter: { type: "prompt_input", canvas: "c", group: "g" }, body: "" }),
    ).not.toThrow();
  });
});
