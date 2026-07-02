// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyMatrixCommand } from "../core/matrix-reducer.ts";
import { createEmptyMatrixDocument, type Cell } from "./domain.ts";
import { detectMatrixGroups, visibleMatrixGroups } from "./matrix-groups.ts";

describe("detectMatrixGroups", () => {
  it("detects 4-adjacent populated cells and ignores diagonal-only cells", () => {
    let document = createEmptyMatrixDocument({ withResearchTemplate: false });
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: null, body: "Alpha" },
        { row: 0, col: 1, value: null, body: "Beta" },
        { row: 3, col: 3, value: null, body: "Diagonal A" },
        { row: 4, col: 4, value: null, body: "Diagonal B" },
      ],
    }).document;

    const groups = visibleMatrixGroups(document);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "Alpha",
      range: { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
    });
  });

  it("preserves a renamed label when the group expands to a neighboring cell", () => {
    let document = createEmptyMatrixDocument({ withResearchTemplate: false });
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 1, col: 1, value: null, body: "Question" },
        { row: 1, col: 2, value: null, body: "Answer" },
      ],
    }).document;
    const group = visibleMatrixGroups(document)[0]!;

    document = applyMatrixCommand(document, {
      type: "set_group_label",
      id: group.id,
      label: "Interview flow",
    }).document;
    document = applyMatrixCommand(document, {
      type: "update_cell_body",
      row: 2,
      col: 2,
      body: "Follow-up",
    }).document;

    expect(visibleMatrixGroups(document)[0]?.label).toBe("Interview flow");
  });

  it("keeps dismissed groups out of the visible list", () => {
    let document = createEmptyMatrixDocument({ withResearchTemplate: false });
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: null, body: "A" },
        { row: 1, col: 0, value: null, body: "B" },
      ],
    }).document;
    const group = detectMatrixGroups(document).values().next().value;
    if (!group) {
      throw new Error("Expected auto group");
    }
    document = applyMatrixCommand(document, { type: "dismiss_group", id: group.id }).document;

    expect(visibleMatrixGroups(document)).toEqual([]);
    expect(document.groups.get(group.id)?.dismissed).toBe(true);
  });

  it("uses the highest-overlap previous label when two groups merge", () => {
    let document = createEmptyMatrixDocument({ withResearchTemplate: false });
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: null, body: "Left A" },
        { row: 0, col: 1, value: null, body: "Left B" },
        { row: 0, col: 4, value: null, body: "Right A" },
        { row: 0, col: 5, value: null, body: "Right B" },
        { row: 1, col: 4, value: null, body: "Right C" },
      ],
    }).document;
    const left = visibleMatrixGroups(document).find((group) => group.range.startCol === 0)!;
    const right = visibleMatrixGroups(document).find((group) => group.range.startCol === 4)!;
    document = applyMatrixCommand(document, {
      type: "set_group_label",
      id: left.id,
      label: "Left group",
    }).document;
    document = applyMatrixCommand(document, {
      type: "set_group_label",
      id: right.id,
      label: "Right group",
    }).document;

    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 2, value: null, body: "Bridge 1" },
        { row: 0, col: 3, value: null, body: "Bridge 2" },
      ],
    }).document;

    expect(visibleMatrixGroups(document)).toHaveLength(1);
    expect(visibleMatrixGroups(document)[0]?.label).toBe("Right group");
  });

  it("does not carry dismissal to an expanded neighboring range", () => {
    let document = createEmptyMatrixDocument({ withResearchTemplate: false });
    document = applyMatrixCommand(document, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: null, body: "A" },
        { row: 0, col: 1, value: null, body: "B" },
      ],
    }).document;
    const group = visibleMatrixGroups(document)[0]!;
    document = applyMatrixCommand(document, { type: "dismiss_group", id: group.id }).document;
    document = applyMatrixCommand(document, {
      type: "update_cell_body",
      row: 0,
      col: 2,
      body: "C",
    }).document;

    expect(visibleMatrixGroups(document)).toHaveLength(1);
    expect(visibleMatrixGroups(document)[0]?.dismissed).toBeUndefined();
  });

  it("does not treat undefined cell values as populated", () => {
    const baseDocument = createEmptyMatrixDocument({ withResearchTemplate: false });
    const document = {
      ...baseDocument,
      sheet: {
        ...baseDocument.sheet,
        cells: new Map([
          ["0,0", { value: undefined, body: "", frontmatter: "" }],
          ["0,1", { value: undefined, body: "", frontmatter: "" }],
        ]) as unknown as ReadonlyMap<string, Cell>,
      },
    };

    expect(detectMatrixGroups(document)).toEqual(new Map());
  });

  it("does not crash on legacy cells without body text", () => {
    const baseDocument = createEmptyMatrixDocument({ withResearchTemplate: false });
    const document = {
      ...baseDocument,
      sheet: {
        ...baseDocument.sheet,
        cells: new Map([
          ["0,0", { value: "A", frontmatter: "" }],
          ["0,1", { value: "B", frontmatter: "" }],
        ]) as unknown as ReadonlyMap<string, Cell>,
      },
    };

    const group = [...detectMatrixGroups(document).values()][0];

    expect(group?.label).toBe("A");
  });
});
