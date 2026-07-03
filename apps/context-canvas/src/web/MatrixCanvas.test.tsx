// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  cellKey,
  MATRIX_SNAPSHOT_MAX_BYTES,
  type MatrixDocument,
  type MatrixGroup,
  type MatrixHistorySnapshot,
} from "../shared/domain.ts";
import type { MatrixGridSelectionState } from "./MatrixGrid.tsx";
import { createHistoryEntry, loadMatrixHistory, saveMatrixHistory } from "./matrix-history.ts";
import { MatrixCanvas } from "./MatrixCanvas.tsx";

vi.mock("./run-matrix.ts", () => ({
  runMatrix: vi.fn().mockResolvedValue({
    command: {
      intent: "test",
      targetRange: { startRow: 0, startCol: 1, endRow: 1, endCol: 2 },
      patches: [
        { row: 0, col: 1, value: "text", body: "Hello, World!" },
      ],
    },
  }),
}));

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

describe("MatrixCanvas AI run history snapshot", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("includes a document snapshot in the history entry after a successful AI run", async () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("pick B1:C2"));
    const input = screen.getByTestId("matrix-composer-input");
    fireEvent.change(input, { target: { value: "Write test data" } });
    fireEvent.click(screen.getByTestId("matrix-set-target"));
    fireEvent.click(screen.getByTestId("matrix-run"));

    await screen.findByText(/Run applied:/);

    let snapshot: MatrixHistorySnapshot | undefined;
    await waitFor(() => {
      const entries = loadMatrixHistory();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      snapshot = entries[0].snapshot;
      expect(snapshot).toBeDefined();
    });
    if (!snapshot) throw new Error("Expected snapshot to be present");
    expect(snapshot.sheet).toBeDefined();
    expect(snapshot.cells.length).toBeGreaterThanOrEqual(1);
    const writtenCell = snapshot.cells.find(
      (c) => c.row === 0 && c.col === 1,
    );
    expect(writtenCell).toBeDefined();
    if (!writtenCell) throw new Error("Expected AI-written cell in snapshot");
    expect(writtenCell.cell.body).toBe("Hello, World!");
    expect(snapshot.serializedBytes).toBeGreaterThan(0);
  });
});

describe("MatrixCanvas history snapshot restore", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  function createRestorableHistoryEntry(options: { readonly truncated?: boolean } = {}) {
    return createHistoryEntry({
      intent: options.truncated ? "Truncated saved run" : "Restore saved run",
      contextRanges: [
        {
          label: "B1:C2",
          range: { startRow: 0, startCol: 1, endRow: 1, endCol: 2 },
          groupId: "history-group",
        },
      ],
      targetRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRangeLabel: "A1",
      patchesApplied: 1,
      snapshot: {
        schemaVersion: 1,
        sheet: {
          id: "history-sheet",
          name: "History Sheet",
          rows: 20,
          cols: 50,
        },
        cells: options.truncated
          ? []
          : [
              {
                row: 0,
                col: 0,
                cell: {
                  value: "restored",
                  body: "Restored A1",
                  frontmatter: "",
                  provenance: "ai",
                },
              },
            ],
        groups: options.truncated
          ? []
          : [
              {
                id: "history-group",
                label: "Restored Group",
                range: { startRow: 0, startCol: 1, endRow: 1, endCol: 2 },
                source: "auto",
              },
            ],
        maxSerializedBytes: MATRIX_SNAPSHOT_MAX_BYTES,
        serializedBytes: 256,
        truncated: options.truncated ?? false,
      },
    });
  }

  function saveRestorableHistory(): void {
    saveMatrixHistory([createRestorableHistoryEntry()]);
  }

  it("restores cells and groups when a snapshot history entry is selected", () => {
    saveRestorableHistory();
    render(<MatrixCanvas />);

    expect(screen.getByTestId("cell-a1").textContent).toBe("");

    fireEvent.click(screen.getByTestId(/^history-entry-/));

    expect(screen.getByTestId("cell-a1").textContent).toBe("Restored A1");
    expect(screen.getByText("group label Restored Group")).toBeTruthy();
    expect(screen.getByTestId("matrix-status-selection").textContent).toContain("A1");
    expect(screen.getByText("Restored history snapshot: A1")).toBeTruthy();
  });

  it("returns from a restored snapshot to the current document", () => {
    saveRestorableHistory();
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit text"));
    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");

    fireEvent.click(screen.getByTestId(/^history-entry-/));
    expect(screen.getByTestId("cell-a1").textContent).toBe("Restored A1");

    fireEvent.click(screen.getByTestId("history-return-current"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");
    expect(screen.getByText("Returned to current document")).toBeTruthy();
  });

  it("returns to the current document before showing a truncated history entry", () => {
    saveMatrixHistory([createRestorableHistoryEntry(), createRestorableHistoryEntry({ truncated: true })]);
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit text"));
    fireEvent.click(screen.getAllByTestId(/^history-entry-/)[0]);
    expect(screen.getByTestId("cell-a1").textContent).toBe("Restored A1");

    fireEvent.click(screen.getAllByTestId(/^history-entry-/)[1]);

    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");
    expect(screen.getByText("History snapshot is truncated and cannot restore full cells")).toBeTruthy();
    expect(screen.queryByTestId("history-return-current")).toBeNull();
  });

  it("returns to the current document when a cell is selected from a restored snapshot", () => {
    saveRestorableHistory();
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit text"));
    fireEvent.click(screen.getByTestId(/^history-entry-/));
    expect(screen.getByTestId("cell-a1").textContent).toBe("Restored A1");

    fireEvent.click(screen.getByText("replay A1"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");
    expect(screen.queryByTestId("history-return-current")).toBeNull();
  });
});
