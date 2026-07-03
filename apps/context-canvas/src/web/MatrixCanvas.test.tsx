// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { cellKey, type MatrixDocument, type MatrixGroup } from "../shared/domain.ts";
import type { MatrixGridSelectionState } from "./MatrixGrid.tsx";
import { MatrixCanvas } from "./MatrixCanvas.tsx";

vi.mock("./MatrixGrid.tsx", () => ({
  MatrixGrid: ({
    document,
    groups,
    onCellEdited,
    onCellsEdited,
    onSelectionChange,
    onGroupLabelClick,
  }: {
    document: MatrixDocument;
    groups: readonly MatrixGroup[];
    onCellEdited: (row: number, col: number, body: string) => void;
    onCellsEdited: (
      edits: readonly { readonly row: number; readonly col: number; readonly body: string }[],
    ) => void;
    onSelectionChange: (selection: MatrixGridSelectionState | null) => void;
    onGroupLabelClick: (
      group: MatrixGroup,
      options: { readonly isDoubleClick: boolean },
    ) => void;
  }) => (
    <div data-testid="matrix-grid">
      <output data-testid="cell-a1">{document.sheet.cells.get(cellKey(0, 0))?.body ?? ""}</output>
      <output data-testid="cell-b2">{document.sheet.cells.get(cellKey(1, 1))?.body ?? ""}</output>
      <button type="button" onClick={() => onCellEdited(0, 0, "=")}>
        edit equals
      </button>
      <button type="button" onClick={() => onCellEdited(0, 0, "hello")}>
        edit text
      </button>
      <button type="button" onClick={() => onCellEdited(1, 1, "hello")}>
        edit B2 text
      </button>
      <button type="button" onClick={() => onCellEdited(0, 0, "=SUM(B1:C2)")}>
        edit formula
      </button>
      <button type="button" onClick={() => onSelectionChange(null)}>
        clear selection
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            startRow: 0,
            startCol: 0,
            endRow: 0,
            endCol: 0,
            activeRow: 0,
            activeCol: 0,
          })
        }
      >
        replay A1
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectionChange({
            startRow: 0,
            startCol: 1,
            endRow: 1,
            endCol: 2,
            activeRow: 0,
            activeCol: 1,
          })
        }
      >
        pick B1:C2
      </button>
      <button
        type="button"
        onClick={() =>
          onCellsEdited([
            { row: 1, col: 0, body: "Alpha" },
            { row: 1, col: 1, body: "Beta" },
          ])
        }
      >
        create group
      </button>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onGroupLabelClick(group, { isDoubleClick: false })}
        >
          group label {group.label}
        </button>
      ))}
    </div>
  ),
}));

describe("MatrixCanvas reference edit mode", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("inserts a picked range into the equals cell", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    expect(screen.getByText("Reference edit mode: select a range or group label")).toBeTruthy();

    fireEvent.click(screen.getByText("pick B1:C2"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=B1:C2");
    expect(screen.getByText("Reference inserted: B1:C2")).toBeTruthy();
  });

  it("inserts a group label token into the equals cell", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("create group"));
    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("group label Alpha"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=Alpha");
    expect(screen.getByText("Reference inserted: Alpha")).toBeTruthy();
  });

  it("keeps a replayed origin selection from inserting a self-reference", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("replay A1"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=");
    expect(screen.getByText("Reference edit mode: select a range or group label")).toBeTruthy();
  });

  it("cancels reference mode when the origin cell is edited to plain text", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("edit text"));
    fireEvent.click(screen.getByText("pick B1:C2"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");
    expect(screen.getByText("Cell A1 updated")).toBeTruthy();
  });

  it("does not enter range-pick mode for a typed formula body", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit formula"));
    fireEvent.click(screen.getByText("pick B1:C2"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=SUM(B1:C2)");
    expect(screen.getByText("Cell A1 updated")).toBeTruthy();
  });

  it("cancels reference mode when selection is cleared", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("clear selection"));
    fireEvent.click(screen.getByText("pick B1:C2"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=");
    expect(screen.getByText("Reference edit cancelled")).toBeTruthy();
  });

  it("cancels reference mode when another cell is edited", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("edit B2 text"));
    fireEvent.click(screen.getByText("pick B1:C2"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=");
    expect(screen.getByTestId("cell-b2").textContent).toBe("hello");
    expect(screen.getByText("Cell B2 updated")).toBeTruthy();
  });

  it("cancels reference mode when a bulk edit is applied", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("create group"));
    fireEvent.click(screen.getByText("pick B1:C2"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=");
    expect(screen.getByTestId("cell-b2").textContent).toBe("Beta");
    expect(screen.getByText("2 cells updated")).toBeTruthy();
  });
});
