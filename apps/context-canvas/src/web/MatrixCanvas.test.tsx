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
import { runMatrix } from "./run-matrix.ts";

vi.mock("./run-matrix.ts", () => ({
  runMatrix: vi.fn(),
}));

function defaultRunMatrixResponse(request: Parameters<typeof runMatrix>[0]) {
  return Promise.resolve({
    command: {
      intent: "test",
      targetRange: request.targetRange,
      patches: [
        {
          row: request.targetRange.startRow,
          col: request.targetRange.startCol,
          value: "text",
          body: "Hello, World!",
        },
      ],
    },
  });
}

vi.mock("./MatrixGrid.tsx", () => ({
  MatrixGrid: ({
    document,
    groups,
    onCellEdited,
    onCellsEdited,
    onSelectionChange,
    onGroupLabelClick,
    onGroupLabelOffsetChange,
    onGroupLabelDraftChange,
    onGroupLabelSave,
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
    onGroupLabelOffsetChange: (
      group: MatrixGroup,
      offset: { readonly x: number; readonly y: number },
    ) => void;
    onGroupLabelDraftChange: (label: string) => void;
    onGroupLabelSave: () => void;
  }) => (
    <div data-testid="matrix-grid">
      <output data-testid="cell-a1">{document.sheet.cells.get(cellKey(0, 0))?.body ?? ""}</output>
      <output data-testid="cell-b1">{document.sheet.cells.get(cellKey(0, 1))?.body ?? ""}</output>
      <output data-testid="cell-b2">{document.sheet.cells.get(cellKey(1, 1))?.body ?? ""}</output>
      <output data-testid="group-count">{groups.length}</output>
      <output data-testid="first-group-offset">
        {groups[0]?.labelOffset ? `${groups[0].labelOffset.x},${groups[0].labelOffset.y}` : ""}
      </output>
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
      <button type="button" onClick={() => onCellEdited(0, 0, "=B1:C2")}>
        edit range formula
      </button>
      <button type="button" onClick={() => onCellEdited(0, 0, "=@inputs")}>
        edit named formula
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
      <button
        type="button"
        onClick={() =>
          onCellsEdited([
            { row: 0, col: 0, body: "Alpha" },
            { row: 0, col: 1, body: "Beta" },
          ])
        }
      >
        create A1 group
      </button>
      {groups[0] && (
        <>
          <button
            type="button"
            onClick={() => onGroupLabelOffsetChange(groups[0]!, { x: 12, y: 8 })}
          >
            move first group
          </button>
          <button
            type="button"
            onClick={() => onGroupLabelClick(groups[0]!, { isDoubleClick: true })}
          >
            start group rename
          </button>
          <button
            type="button"
            onClick={() => onGroupLabelDraftChange("Renamed group")}
          >
            change group rename draft
          </button>
          <button
            type="button"
            onClick={() => onGroupLabelSave()}
          >
            save group rename
          </button>
        </>
      )}
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

function pressUndo(target: Element): void {
  fireEvent.keyDown(target, {
    key: "z",
    ctrlKey: true,
  });
}

function pressRedo(target: Element): void {
  fireEvent.keyDown(target, {
    key: "y",
    ctrlKey: true,
  });
}

function createRestorableHistoryEntry(
  options: {
    readonly truncated?: boolean;
    readonly restoredFrontmatter?: string;
  } = {},
) {
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
                frontmatter: options.restoredFrontmatter ?? "",
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

describe("MatrixCanvas reference edit mode", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(runMatrix).mockImplementation(() => new Promise(() => undefined));
  });

  it("shows the AI command bar even before a selection is made", () => {
    render(<MatrixCanvas />);

    expect(screen.getByLabelText("Selection None")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compare" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
  });

  it("inserts a picked range into the equals cell", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    expect(screen.getByText("Reference edit mode: select a range or group label")).toBeTruthy();

    fireEvent.click(screen.getByText("pick B1:C2"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=B1:C2");
    expect(screen.getByText("Running cell reference: B1:C2")).toBeTruthy();
  });

  it("inserts a group label token into the equals cell", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("create group"));
    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("group label Alpha"));

    expect(screen.getByTestId("cell-a1").textContent).toBe("=Alpha");
    expect(screen.getByText("Running cell reference: Alpha")).toBeTruthy();
    const request = vi.mocked(runMatrix).mock.calls[0]?.[0];
    expect(request?.compiled.contextRangeLabels).toEqual(["Alpha (A1:B2)"]);
    expect(request?.compiled.contextText).not.toContain("A1: =Alpha");
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

describe("MatrixCanvas consecutive shortcut runs", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(runMatrix).mockImplementation(defaultRunMatrixResponse);
  });

  it("queues a second shortcut while the first matrix run is still processing", async () => {
    let resolveFirst!: (response: Awaited<ReturnType<typeof runMatrix>>) => void;
    const firstResponse = new Promise<Awaited<ReturnType<typeof runMatrix>>>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(runMatrix)
      .mockImplementationOnce(() => firstResponse)
      .mockImplementation(defaultRunMatrixResponse);

    render(<MatrixCanvas />);
    fireEvent.click(screen.getByText("replay A1"));
    const input = screen.getByTestId("matrix-composer-input");
    fireEvent.change(input, { target: { value: "first prompt" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(runMatrix).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("pick B1:C2"));
    fireEvent.change(input, { target: { value: "second prompt" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    const firstRequest = vi.mocked(runMatrix).mock.calls[0]?.[0];
    expect(firstRequest).toBeDefined();
    resolveFirst(await defaultRunMatrixResponse(firstRequest!));

    await waitFor(() => expect(runMatrix).toHaveBeenCalledTimes(2));
    expect(vi.mocked(runMatrix).mock.calls[1]?.[0].prompt).toBe("second prompt");
    expect(vi.mocked(runMatrix).mock.calls[1]?.[0].targetRange).toEqual({
      startRow: 2,
      startCol: 1,
      endRow: 3,
      endCol: 2,
    });
  });

  it("re-infers the target after a completed shortcut when the selection changes", async () => {
    render(<MatrixCanvas />);
    fireEvent.click(screen.getByText("replay A1"));
    const input = screen.getByTestId("matrix-composer-input");
    fireEvent.change(input, { target: { value: "first prompt" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true, shiftKey: true });

    await waitFor(() => expect(runMatrix).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("pick B1:C2"));
    fireEvent.change(input, { target: { value: "second prompt" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true, shiftKey: true });

    await waitFor(() => expect(runMatrix).toHaveBeenCalledTimes(2));
    expect(vi.mocked(runMatrix).mock.calls[1]?.[0].targetRange).toEqual({
      startRow: 0,
      startCol: 3,
      endRow: 1,
      endCol: 4,
    });
  });
});

// RELATED: issue-135 — Matrix/Grid-only edit undo stack behavior.
describe("MatrixCanvas edit undo/redo", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(runMatrix).mockImplementation(defaultRunMatrixResponse);
  });

  it("undoes and redoes a completed cell edit from grid focus", () => {
    render(<MatrixCanvas />);
    const grid = screen.getByTestId("matrix-grid");

    fireEvent.click(screen.getByText("edit text"));
    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");

    pressUndo(grid);
    expect(screen.getByTestId("cell-a1").textContent).toBe("");

    pressRedo(grid);
    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");
  });

  it("treats a bulk edit as one undo entry", () => {
    render(<MatrixCanvas />);
    const grid = screen.getByTestId("matrix-grid");

    fireEvent.click(screen.getByText("create group"));
    expect(screen.getByTestId("cell-b2").textContent).toBe("Beta");
    expect(screen.getByTestId("group-count").textContent).toBe("1");

    pressUndo(grid);

    expect(screen.getByTestId("cell-b2").textContent).toBe("");
    expect(screen.getByTestId("group-count").textContent).toBe("0");
  });

  it("keeps undo out of active text editors", () => {
    render(<MatrixCanvas />);
    const grid = screen.getByTestId("matrix-grid");

    fireEvent.click(screen.getByText("edit text"));
    fireEvent.click(screen.getByText("replay A1"));
    const textarea = screen.getByTestId("side-panel-textarea");

    pressUndo(textarea);
    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");

    pressUndo(grid);
    expect(screen.getByTestId("cell-a1").textContent).toBe("");
  });

  it("records detail pane body and frontmatter save as one undo entry", () => {
    render(<MatrixCanvas />);
    const grid = screen.getByTestId("matrix-grid");

    fireEvent.click(screen.getByText("edit text"));
    fireEvent.click(screen.getByText("replay A1"));
    fireEvent.change(screen.getByTestId("side-panel-textarea"), {
      target: { value: "detail body" },
    });
    fireEvent.change(screen.getByTestId("side-panel-frontmatter"), {
      target: { value: "status: draft" },
    });
    fireEvent.click(screen.getByTestId("side-panel-save"));
    expect(screen.getByTestId("cell-a1").textContent).toBe("detail body");

    pressUndo(grid);
    expect(screen.getByTestId("cell-a1").textContent).toBe("hello");

    pressRedo(grid);
    expect(screen.getByTestId("cell-a1").textContent).toBe("detail body");
  });

  it("undoes group rename, move, and dismiss operations", () => {
    render(<MatrixCanvas />);
    const grid = screen.getByTestId("matrix-grid");

    fireEvent.click(screen.getByText("create group"));
    expect(screen.getByText("group label Alpha")).toBeTruthy();

    fireEvent.click(screen.getByText("start group rename"));
    fireEvent.click(screen.getByText("change group rename draft"));
    fireEvent.click(screen.getByText("save group rename"));
    expect(screen.getByText("group label Renamed group")).toBeTruthy();
    pressUndo(grid);
    expect(screen.getByText("group label Alpha")).toBeTruthy();

    fireEvent.click(screen.getByText("move first group"));
    expect(screen.getByTestId("first-group-offset").textContent).toBe("12,8");
    fireEvent.click(screen.getByText("replay A1"));
    expect(screen.getByTestId("side-panel-textarea")).toBeTruthy();
    pressUndo(grid);
    expect(screen.getByTestId("first-group-offset").textContent).toBe("");
    expect(screen.getByTestId("side-panel-textarea")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Hide Alpha"));
    expect(screen.getByTestId("group-count").textContent).toBe("0");
    pressUndo(grid);
    expect(screen.getByText("group label Alpha")).toBeTruthy();
  });

  it("undoes AI application without removing Recent Activity", async () => {
    render(<MatrixCanvas />);
    const grid = screen.getByTestId("matrix-grid");

    fireEvent.click(screen.getByText("pick B1:C2"));
    fireEvent.change(screen.getByTestId("matrix-composer-input"), {
      target: { value: "Write test data" },
    });
    fireEvent.click(screen.getByTestId("matrix-set-target"));
    fireEvent.click(screen.getByTestId("matrix-run"));

    await screen.findByText(/Run applied:/);
    expect(screen.getByTestId("cell-b1").textContent).toBe("Hello, World!");
    expect(screen.getAllByTestId(/^history-entry-/)).toHaveLength(1);

    pressUndo(grid);
    expect(screen.getByTestId("cell-b1").textContent).toBe("");
    expect(screen.getAllByTestId(/^history-entry-/)).toHaveLength(1);
  });

  it("returns from Recent Activity preview before undoing the live document", () => {
    saveMatrixHistory([createRestorableHistoryEntry()]);
    render(<MatrixCanvas />);
    const grid = screen.getByTestId("matrix-grid");

    fireEvent.click(screen.getByText("edit text"));
    fireEvent.click(screen.getByTestId(/^history-entry-/));
    expect(screen.getByTestId("cell-a1").textContent).toBe("Restored A1");

    pressUndo(grid);

    expect(screen.getByTestId("cell-a1").textContent).toBe("");
    expect(screen.queryByTestId("history-return-current")).toBeNull();
  });

  it("does not copy preview metadata into a live bulk edit", () => {
    saveMatrixHistory([createRestorableHistoryEntry({ restoredFrontmatter: "status: preview" })]);
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByTestId(/^history-entry-/));
    expect(screen.getByTestId("cell-a1").textContent).toBe("Restored A1");

    fireEvent.click(screen.getByText("create A1 group"));
    expect(screen.getByTestId("cell-a1").textContent).toBe("Alpha");

    fireEvent.click(screen.getByText("replay A1"));
    expect((screen.getByTestId("side-panel-frontmatter") as HTMLTextAreaElement).value).toBe("");
  });
});

describe("MatrixCanvas cell reference AI formula", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(runMatrix).mockImplementation(defaultRunMatrixResponse);
  });

  it("runs matrix AI for a picked range reference and writes the result into the formula cell", async () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("pick B1:C2"));

    await screen.findByText("Running cell reference: B1:C2");
    await screen.findByText("Cell reference applied: 1 cells updated");

    expect(screen.getByTestId("cell-a1").textContent).toBe("Hello, World!");
    expect(runMatrix).toHaveBeenCalledTimes(1);
    const request = vi.mocked(runMatrix).mock.calls[0]?.[0];
    expect(request?.targetRange).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    expect(request?.compiled.contextRangeLabels).toEqual(["B1:C2 (B1:C2)"]);
    expect(request?.compiled.targetRangeLabel).toBe("A1:A1");
  });

  it("shows loading and failure status while preserving the formula for retry", async () => {
    vi.mocked(runMatrix).mockRejectedValueOnce(new Error("Network down"));
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit range formula"));

    await screen.findByText("Running cell reference: B1:C2");
    await screen.findByText("Cell reference failed: Network down");

    expect(screen.getByTestId("cell-a1").textContent).toBe("=B1:C2");
  });

  it("runs matrix AI for a group label reference without compiling the formula cell as context", async () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("create group"));
    fireEvent.click(screen.getByText("edit equals"));
    fireEvent.click(screen.getByText("group label Alpha"));

    await screen.findByText("Cell reference applied: 1 cells updated");

    expect(screen.getByTestId("cell-a1").textContent).toBe("Hello, World!");
    const request = vi.mocked(runMatrix).mock.calls[0]?.[0];
    expect(request?.compiled.contextRangeLabels).toEqual(["Alpha (A1:B2)"]);
    expect(request?.compiled.contextText).not.toContain("A1: =Alpha");
  });

  it("runs matrix AI for a named range reference", async () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("pick B1:C2"));
    fireEvent.change(screen.getByTestId("matrix-range-name-input"), {
      target: { value: "inputs" },
    });
    fireEvent.click(screen.getByTestId("matrix-name-range"));
    fireEvent.click(screen.getByText("edit named formula"));

    await screen.findByText("Cell reference applied: 1 cells updated");

    expect(screen.getByTestId("cell-a1").textContent).toBe("Hello, World!");
    const request = vi.mocked(runMatrix).mock.calls[0]?.[0];
    expect(request?.compiled.contextRangeLabels).toEqual(["@inputs (B1:C2)"]);
  });

  it("does not run matrix AI for non-reference formulas", () => {
    render(<MatrixCanvas />);

    fireEvent.click(screen.getByText("edit formula"));

    expect(runMatrix).not.toHaveBeenCalled();
    expect(screen.getByTestId("cell-a1").textContent).toBe("=SUM(B1:C2)");
  });
});

describe("MatrixCanvas AI run history snapshot", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(runMatrix).mockImplementation(defaultRunMatrixResponse);
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
