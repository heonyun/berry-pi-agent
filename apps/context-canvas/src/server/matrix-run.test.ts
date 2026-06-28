// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractJsonObject } from "./matrix-run.ts";
import { parseAiCommand } from "../shared/matrix-validation.ts";

describe("extractJsonObject", () => {
  it("parses fenced JSON blocks", () => {
    const raw = 'Here is the command:\n```json\n{"intent":"x","targetRange":{"startRow":0,"startCol":0,"endRow":0,"endCol":0},"patches":[]}\n```';
    expect(extractJsonObject(raw)).toEqual({
      intent: "x",
      targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      patches: [],
    });
  });

  it("parses the first JSON object in free text", () => {
    const raw = 'prefix {"intent":"y","targetRange":{"startRow":1,"startCol":1,"endRow":1,"endCol":1},"patches":[]} suffix';
    expect(extractJsonObject(raw)).toMatchObject({ intent: "y" });
  });
});

describe("matrix-run AiCommand extraction", () => {
  it("validates nested command envelopes from model output", () => {
    const raw = JSON.stringify({
      command: {
        intent: "z",
        targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        patches: [],
      },
    });
    const parsed = parseAiCommand(extractJsonObject(raw));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.command.intent).toBe("z");
    }
  });
});
