// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseMatrixRunResponse } from "./run-matrix.ts";

const sampleCommand = {
  intent: "Fill cells",
  targetRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
  patches: [{ row: 0, col: 0, value: "done", body: "Done" }],
};

describe("parseMatrixRunResponse", () => {
  it("accepts the documented { command } envelope", () => {
    const result = parseMatrixRunResponse({ command: sampleCommand });
    expect(result.command).toEqual(sampleCommand);
  });

  it("accepts bare AiCommand JSON at the response root", () => {
    const result = parseMatrixRunResponse(sampleCommand);
    expect(result.command).toEqual(sampleCommand);
  });

  it("throws when the payload is not an AiCommand", () => {
    expect(() => parseMatrixRunResponse({ command: {} })).toThrow(/does not match AiCommand schema/);
  });
});
