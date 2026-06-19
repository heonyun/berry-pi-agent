// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compilePromptContext } from "../../shared/compiler.ts";
import { createInitialDocument, type ContextCanvasDocument } from "../../shared/domain.ts";
import { parse } from "./document.ts";
import { loadBundleToDocument } from "./load.ts";
import { groupIndexPath, nodeIdToPath, rootIndexPath } from "./paths.ts";
import { projectDocumentToBundle } from "./project.ts";
import { CANVAS_SIDECAR } from "./sidecar.ts";

function sampleDocument(): ContextCanvasDocument {
  return {
    ...createInitialDocument(),
    nodes: [
      {
        id: "answer-1",
        kind: "ai_answer",
        groupId: "group-1",
        text: "Prior answer",
        position: { x: 0, y: -240 },
        metadata: { stance: "neutral" },
        feedback: "disagree",
      },
      {
        id: "prompt-2",
        kind: "prompt_input",
        groupId: "group-1",
        text: "Follow up",
        position: { x: -360, y: -480 },
        metadata: { stance: "neutral" },
      },
    ],
    edges: [
      {
        id: "edge-lineage-answer-1-prompt-2",
        source: "answer-1",
        target: "prompt-2",
        meaning: "lineage",
      },
      {
        id: "edge-ref-answer-1-prompt-2",
        source: "answer-1",
        target: "prompt-2",
        meaning: "context_reference",
      },
    ],
  };
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "context-bundle-"));
  tempDirs.push(dir);
  return dir;
}

describe("projectDocumentToBundle", () => {
  it("writes node markdown, indexes, and canvas sidecar", () => {
    const bundleRoot = makeTempDir();
    const document = sampleDocument();
    const result = projectDocumentToBundle(document, bundleRoot);

    expect(result.errors).toEqual([]);
    expect(result.pathsWritten).toContain("nodes/prompt-2.md");
    expect(result.pathsWritten).toContain("nodes/answer-1.md");
    expect(result.pathsWritten).toContain(CANVAS_SIDECAR);
    expect(fs.existsSync(rootIndexPath(bundleRoot))).toBe(true);

    const promptMarkdown = parse(fs.readFileSync(nodeIdToPath(bundleRoot, "prompt-2"), "utf8"));
    expect(promptMarkdown.frontmatter.type).toBe("prompt_input");
    expect(promptMarkdown.frontmatter.lineage_parent).toBe("answer-1");
    expect(promptMarkdown.frontmatter.context_refs).toEqual(["answer-1"]);
    expect(promptMarkdown.frontmatter.stance).toBe("critical");
    expect(promptMarkdown.body).toContain("# Lineage");
    expect(promptMarkdown.body).toContain("../nodes/answer-1.md");
    expect(promptMarkdown.body).toContain("# Context References");
  });

  it("projects compiled snapshots when requested", () => {
    const bundleRoot = makeTempDir();
    const document = sampleDocument();
    const compiled = compilePromptContext(document, "prompt-2");
    const result = projectDocumentToBundle(document, bundleRoot, {
      includeCompiled: true,
      compiledByPromptId: new Map([["prompt-2", compiled]]),
    });

    expect(result.errors).toEqual([]);
    expect(result.pathsWritten).toContain("compiled/prompt-2.md");

    const promptMarkdown = parse(fs.readFileSync(nodeIdToPath(bundleRoot, "prompt-2"), "utf8"));
    expect(promptMarkdown.body).toContain("# Compiled Snapshot");
    expect(promptMarkdown.body).toContain("stance: critical");
  });
});

describe("loadBundleToDocument", () => {
  it("round-trips through the canvas sidecar", () => {
    const bundleRoot = makeTempDir();
    const document = sampleDocument();
    projectDocumentToBundle(document, bundleRoot);

    const loaded = loadBundleToDocument(bundleRoot);
    expect(loaded.errors).toEqual([]);
    expect(loaded.document).toEqual(document);
  });

  it("loads from markdown when sidecar is missing", () => {
    const bundleRoot = makeTempDir();
    const document = sampleDocument();
    projectDocumentToBundle(document, bundleRoot, { writeCanvasSidecar: false });
    fs.rmSync(path.join(bundleRoot, CANVAS_SIDECAR), { force: true });

    const loaded = loadBundleToDocument(bundleRoot);
    expect(loaded.document?.nodes).toHaveLength(2);
    expect(loaded.document?.edges).toHaveLength(2);
    expect(loaded.warnings.some((warning) => warning.includes(CANVAS_SIDECAR))).toBe(true);
  });

  it("round-trips group summaries through markdown group indexes without a sidecar", () => {
    const bundleRoot = makeTempDir();
    const document: ContextCanvasDocument = {
      ...sampleDocument(),
      groups: [
        {
          id: "group-1",
          title: "Conversation",
          origin: { x: 0, y: 0 },
          summary: "Editable group summary",
        },
      ],
    };

    const result = projectDocumentToBundle(document, bundleRoot, { writeCanvasSidecar: false });
    expect(result.pathsWritten).toContain("groups/group-1/index.md");

    const groupMarkdown = parse(fs.readFileSync(groupIndexPath(bundleRoot, "group-1"), "utf8"));
    expect(groupMarkdown.frontmatter.type).toBe("context_group");
    expect(groupMarkdown.frontmatter.summary).toBe("Editable group summary");
    expect(groupMarkdown.frontmatter.member_ids).toEqual(["answer-1", "prompt-2"]);

    const loaded = loadBundleToDocument(bundleRoot);
    expect(loaded.document?.groups[0]).toMatchObject({
      id: "group-1",
      summary: "Editable group summary",
    });
  });
});

describe("bundle path safety", () => {
  it("rejects unsafe node ids during export", () => {
    const bundleRoot = makeTempDir();
    const document = {
      ...sampleDocument(),
      nodes: [
        {
          id: "../evil",
          kind: "prompt_input" as const,
          groupId: "group-1",
          text: "bad",
          position: { x: 0, y: 0 },
          metadata: { stance: "neutral" as const },
        },
      ],
      edges: [],
    };

    expect(() => projectDocumentToBundle(document, bundleRoot)).toThrow(/Invalid nodeId/);
  });
});
