// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyMatrixCommand } from "../core/matrix-reducer.ts";
import { cellKey, createEmptyMatrixDocument } from "../shared/domain.ts";
import {
  createMatrixEditHistoryEntry,
  createMatrixEditHistoryState,
  pushMatrixEditHistoryEntry,
  redoMatrixEditHistory,
  restoreMatrixEditHistoryEntry,
  undoMatrixEditHistory,
} from "./matrix-edit-history.ts";

// RELATED: issue-135 — unit coverage for Matrix/Grid session edit history.
describe("matrix-edit-history", () => {
  it("stores affected cells and groups for undo and redo", () => {
    const before = createEmptyMatrixDocument({ withResearchTemplate: false });
    const after = applyMatrixCommand(before, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: null, body: "Question" },
        { row: 0, col: 1, value: null, body: "Answer" },
      ],
    }).document;

    const entry = createMatrixEditHistoryEntry({
      operationType: "cells.edit",
      label: "Edit 2 cells",
      beforeDocument: before,
      afterDocument: after,
      affectedCells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
    });

    expect(entry).not.toBeNull();
    const undone = restoreMatrixEditHistoryEntry(after, entry!, "undo");
    expect(undone.sheet.cells.has(cellKey(0, 0))).toBe(false);
    expect(undone.sheet.cells.has(cellKey(0, 1))).toBe(false);
    expect(undone.groups.size).toBe(0);

    const redone = restoreMatrixEditHistoryEntry(undone, entry!, "redo");
    expect(redone.sheet.cells.get(cellKey(0, 0))?.body).toBe("Question");
    expect(redone.sheet.cells.get(cellKey(0, 1))?.body).toBe("Answer");
    expect([...redone.groups.values()][0]?.label).toBe("Question");
  });

  it("stores group-only operations without requiring affected cells", () => {
    let before = createEmptyMatrixDocument({ withResearchTemplate: false });
    before = applyMatrixCommand(before, {
      type: "apply_patches",
      patches: [
        { row: 0, col: 0, value: null, body: "Question" },
        { row: 0, col: 1, value: null, body: "Answer" },
      ],
    }).document;
    const group = [...before.groups.values()][0]!;
    const after = applyMatrixCommand(before, {
      type: "set_group_label",
      id: group.id,
      label: "Research pair",
    }).document;

    const entry = createMatrixEditHistoryEntry({
      operationType: "group.rename",
      label: "Rename group",
      beforeDocument: before,
      afterDocument: after,
      affectedCells: [],
    });

    expect(entry).not.toBeNull();
    expect(restoreMatrixEditHistoryEntry(after, entry!, "undo").groups.get(group.id)?.label).toBe(
      "Question",
    );
    expect(restoreMatrixEditHistoryEntry(before, entry!, "redo").groups.get(group.id)?.label).toBe(
      "Research pair",
    );
  });

  it("returns null for no-op entries", () => {
    const document = createEmptyMatrixDocument();

    expect(
      createMatrixEditHistoryEntry({
        operationType: "cells.edit",
        label: "No change",
        beforeDocument: document,
        afterDocument: document,
        affectedCells: [{ row: 0, col: 0 }],
      }),
    ).toBeNull();
  });

  it("moves entries between undo and redo stacks", () => {
    const before = createEmptyMatrixDocument({ withResearchTemplate: false });
    const after = applyMatrixCommand(before, {
      type: "update_cell_body",
      row: 0,
      col: 0,
      body: "Draft",
    }).document;
    const entry = createMatrixEditHistoryEntry({
      operationType: "cells.edit",
      label: "Edit A1",
      beforeDocument: before,
      afterDocument: after,
      affectedCells: [{ row: 0, col: 0 }],
    })!;

    const state = pushMatrixEditHistoryEntry(createMatrixEditHistoryState(), entry);
    const undone = undoMatrixEditHistory(after, state);
    expect(undone.document.sheet.cells.has(cellKey(0, 0))).toBe(false);
    expect(undone.state.undoStack).toHaveLength(0);
    expect(undone.state.redoStack).toHaveLength(1);

    const redone = redoMatrixEditHistory(undone.document, undone.state);
    expect(redone.document.sheet.cells.get(cellKey(0, 0))?.body).toBe("Draft");
    expect(redone.state.undoStack).toHaveLength(1);
    expect(redone.state.redoStack).toHaveLength(0);
  });

  it("clears redo stack when a new entry is pushed", () => {
    const document = createEmptyMatrixDocument({ withResearchTemplate: false });
    const first = createMatrixEditHistoryEntry({
      operationType: "cells.edit",
      label: "First",
      beforeDocument: document,
      afterDocument: applyMatrixCommand(document, {
        type: "update_cell_body",
        row: 0,
        col: 0,
        body: "First",
      }).document,
      affectedCells: [{ row: 0, col: 0 }],
    })!;
    const second = createMatrixEditHistoryEntry({
      operationType: "cells.edit",
      label: "Second",
      beforeDocument: document,
      afterDocument: applyMatrixCommand(document, {
        type: "update_cell_body",
        row: 1,
        col: 1,
        body: "Second",
      }).document,
      affectedCells: [{ row: 1, col: 1 }],
    })!;

    const undone = undoMatrixEditHistory(
      restoreMatrixEditHistoryEntry(document, first, "redo"),
      pushMatrixEditHistoryEntry(createMatrixEditHistoryState(), first),
    );
    const next = pushMatrixEditHistoryEntry(undone.state, second);

    expect(next.undoStack.map((entry) => entry.label)).toEqual(["Second"]);
    expect(next.redoStack).toHaveLength(0);
  });
});
