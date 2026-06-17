import { describe, expect, it } from "vitest";
import { compilePromptContext } from "./compiler.ts";
import { buildNodeBacklinks, formatCompiledPreviewMarkdown } from "./compile-preview.ts";
import { createInitialDocument } from "./domain.ts";

describe("formatCompiledPreviewMarkdown", () => {
  it("renders stance, trace, and prompt payload as markdown", () => {
    const document = {
      ...createInitialDocument(),
      nodes: [
        {
          id: "answer-1",
          kind: "ai_answer" as const,
          groupId: "group-1",
          text: "Prior answer",
          position: { x: 0, y: -240 },
          metadata: { stance: "neutral" as const },
          feedback: "disagree" as const,
        },
        {
          id: "prompt-2",
          kind: "prompt_input" as const,
          groupId: "group-1",
          text: "Follow up",
          position: { x: -360, y: -480 },
          metadata: { stance: "neutral" as const },
        },
      ],
      edges: [
        {
          id: "edge-lineage",
          source: "answer-1",
          target: "prompt-2",
          meaning: "lineage" as const,
        },
        {
          id: "edge-ref",
          source: "answer-1",
          target: "prompt-2",
          meaning: "context_reference" as const,
        },
      ],
    };

    const compiled = compilePromptContext(document, "prompt-2");
    const markdown = formatCompiledPreviewMarkdown(compiled);

    expect(markdown).toContain("# Compiled Prompt: prompt-2");
    expect(markdown).toContain("**Stance:** critical");
    expect(markdown).toContain("`answer-1`");
    expect(markdown).toContain("```text");
    expect(markdown).toContain("Follow up");
  });
});

describe("buildNodeBacklinks", () => {
  it("lists prompts that consume a node as context", () => {
    const document = {
      ...createInitialDocument(),
      nodes: [
        {
          id: "answer-1",
          kind: "ai_answer" as const,
          groupId: "group-1",
          text: "A",
          position: { x: 0, y: -240 },
          metadata: { stance: "neutral" as const },
        },
        {
          id: "prompt-2",
          kind: "prompt_input" as const,
          groupId: "group-1",
          text: "B",
          position: { x: 0, y: -480 },
          metadata: { stance: "neutral" as const },
        },
      ],
      edges: [
        {
          id: "edge-ref",
          source: "answer-1",
          target: "prompt-2",
          meaning: "context_reference" as const,
        },
      ],
    };

    expect(buildNodeBacklinks(document, "answer-1")).toEqual([
      { nodeId: "prompt-2", reason: "uses_as_context" },
    ]);
  });

  it("lists downstream lineage prompts for an answer node", () => {
    const document = {
      ...createInitialDocument(),
      nodes: [
        {
          id: "answer-1",
          kind: "ai_answer" as const,
          groupId: "group-1",
          text: "A",
          position: { x: 0, y: -240 },
          metadata: { stance: "neutral" as const },
        },
        {
          id: "prompt-2",
          kind: "prompt_input" as const,
          groupId: "group-1",
          text: "B",
          position: { x: 0, y: -480 },
          metadata: { stance: "neutral" as const },
        },
      ],
      edges: [
        {
          id: "edge-lineage",
          source: "answer-1",
          target: "prompt-2",
          meaning: "lineage" as const,
        },
      ],
    };

    expect(buildNodeBacklinks(document, "answer-1")).toEqual([
      { nodeId: "prompt-2", reason: "lineage_child" },
    ]);
  });
});
