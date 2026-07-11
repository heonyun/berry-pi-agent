/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle, useState } from "react";
import {
  GridCellKind,
  type DataEditorProps,
  type ProvideEditorCallbackResult,
  type TextCell,
} from "@glideapps/glide-data-grid";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyMatrixDocument, type MatrixGroup } from "../shared/domain.ts";
import type { MatrixInlineCommitRunRequest } from "../shared/matrix-shortcut.ts";
import { MatrixGrid } from "./MatrixGrid.tsx";

const dataEditorState = vi.hoisted(() => ({
  props: null as DataEditorProps | null,
  gridRef: { getBounds: vi.fn() },
}));

vi.mock("@glideapps/glide-data-grid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@glideapps/glide-data-grid")>();
  return {
    ...actual,
    DataEditor: forwardRef((props: DataEditorProps, ref) => {
      dataEditorState.props = props;
      useImperativeHandle(ref, () => dataEditorState.gridRef as never, []);
      return (
        <div data-testid="mock-data-editor">
          <canvas data-testid="data-grid-canvas" />
        </div>
      );
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  dataEditorState.props = null;
  dataEditorState.gridRef.getBounds.mockReset();
});

function renderMatrixGrid(): void {
  renderMatrixGridWithGroups([]);
}

function renderMatrixGridWithGroups(
  groups: readonly MatrixGroup[],
  onInlineCommitRun: (request: MatrixInlineCommitRunRequest) => void = vi.fn(),
): void {
  render(
    <MatrixGrid
      document={createEmptyMatrixDocument({ withResearchTemplate: false })}
      groups={groups}
      selection={null}
      editingGroupId={null}
      groupLabelDraft=""
      onCellClick={vi.fn()}
      onCellEdited={vi.fn()}
      onCellsEdited={vi.fn()}
      onInlineCommitRun={onInlineCommitRun}
      onGroupLabelDraftChange={vi.fn()}
      onGroupLabelSave={vi.fn()}
      onGroupLabelCancel={vi.fn()}
      onSelectionChange={vi.fn()}
    />,
  );
}

describe("MatrixGrid overlay positioning", () => {
  it("skips overlay positions when Glide returns non-finite bounds", () => {
    const group = {
      id: "group-1",
      label: "Alpha",
      range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      source: "auto",
    } as const;
    dataEditorState.gridRef.getBounds.mockReturnValue({
      x: Number.NaN,
      y: Number.NaN,
      width: 100,
      height: 32,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("data-testid") === "matrix-grid") {
        return { x: 0, y: 0, width: 400, height: 400 } as DOMRect;
      }
      if (this.getAttribute("data-testid") === "data-grid-canvas") {
        return { x: 0, y: 0, width: 400, height: 400 } as DOMRect;
      }
      return { x: 0, y: 0, width: 0, height: 0 } as DOMRect;
    });

    renderMatrixGridWithGroups([group]);

    expect(screen.queryByTestId("matrix-group-outline-group-1")).toBeNull();
    expect(screen.queryByTestId("matrix-cell-corner-dot-0-0-bottom-right")).toBeNull();
  });

  it("clears overlay positions when the container bounds are non-finite", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("data-testid") === "matrix-grid") {
        return { x: Number.NaN, y: 0, width: 400, height: 400 } as DOMRect;
      }
      return { x: 0, y: 0, width: 400, height: 400 } as DOMRect;
    });

    renderMatrixGrid();

    expect(screen.queryByTestId("matrix-row-resize-0")).toBeNull();
    expect(screen.queryByTestId("matrix-cell-corner-dot-0-0-bottom-right")).toBeNull();
  });
});

function getTextEditor(result: ProvideEditorCallbackResult<TextCell>) {
  expect(result).toBeTruthy();
  expect(typeof result).toBe("object");
  if (!result || typeof result !== "object" || !("editor" in result)) {
    throw new Error("Expected MatrixGrid to provide an object text editor");
  }
  return result.editor;
}

describe("MatrixGrid IME overlay editor", () => {
  it("provides an ImeTextarea-backed editor for text cells", () => {
    renderMatrixGrid();

    const provideEditor = dataEditorState.props?.provideEditor;
    expect(provideEditor).toBeTypeOf("function");

    const TextEditor = getTextEditor(
      provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onChange = vi.fn();
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={onChange}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor") as HTMLTextAreaElement;
    expect(editor.className).toContain("gdg-input");

    fireEvent.compositionStart(editor);
    fireEvent.change(editor, { target: { value: "안ㄴ" } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: "안ㄴ", displayData: "안ㄴ" }),
    );
    expect(onFinishedEditing).not.toHaveBeenCalled();

    fireEvent.compositionEnd(editor, { data: "안녕", target: { value: "안녕" } });
    expect(onFinishedEditing).not.toHaveBeenCalled();

    fireEvent.blur(editor);

    expect(onFinishedEditing).toHaveBeenCalledWith(
      expect.objectContaining({ data: "안녕", displayData: "안녕" }),
      undefined,
    );
  });

  // RELATED: issue-133 — locks Glide edit-on-type IME seed behavior against one-letter cells.
  it("clears a Latin edit-on-type seed when IME composition starts", () => {
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onChange = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={onChange}
        onFinishedEditing={vi.fn()}
        value={{
          kind: GridCellKind.Text,
          data: "a",
          displayData: "a",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        initialValue="a"
        forceEditMode={true}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor") as HTMLTextAreaElement;
    fireEvent.compositionStart(editor);

    expect(editor.value).toBe("");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: "", displayData: "" }));

    fireEvent.change(editor, { target: { value: "a" } });
    fireEvent.compositionStart(editor);

    expect(editor.value).toBe("a");
    expect(
      onChange.mock.calls.filter(([cell]) => cell.data === "" && cell.displayData === ""),
    ).toHaveLength(1);
  });

  it("clears a Latin edit-on-type DOM seed when the source cell is empty", () => {
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onChange = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={onChange}
        onFinishedEditing={vi.fn()}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        initialValue="a"
        forceEditMode={true}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor") as HTMLTextAreaElement;
    editor.value = "a";
    fireEvent.compositionStart(editor);

    expect(editor.value).toBe("");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: "", displayData: "" }));
  });

  it("keeps an edit-on-type seed cleared after the parent editor value updates", () => {
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );

    function StatefulEditor() {
      const [cell, setCell] = useState<TextCell>({
        kind: GridCellKind.Text,
        data: "a",
        displayData: "a",
        allowOverlay: true,
      });
      return (
        <TextEditor
          isHighlighted={false}
          onChange={setCell}
          onFinishedEditing={vi.fn()}
          value={cell}
          target={{ x: 0, y: 0, width: 100, height: 32 }}
          initialValue="a"
          forceEditMode={true}
          theme={{} as never}
        />
      );
    }

    render(<StatefulEditor />);

    const editor = screen.getByLabelText("Matrix cell editor") as HTMLTextAreaElement;
    fireEvent.compositionStart(editor);

    expect(editor.value).toBe("");
  });

  it("keeps intentional single-letter cell text when IME composition starts", () => {
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "a",
        displayData: "a",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onChange = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={onChange}
        onFinishedEditing={vi.fn()}
        value={{
          kind: GridCellKind.Text,
          data: "a",
          displayData: "a",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor") as HTMLTextAreaElement;
    fireEvent.compositionStart(editor);

    expect(editor.value).toBe("a");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cancels the text editor without saving again on blur", () => {
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "draft",
        displayData: "draft",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onChange = vi.fn();
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={onChange}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "draft",
          displayData: "draft",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.keyDown(editor, { key: "Escape" });
    fireEvent.blur(editor);

    expect(onFinishedEditing).toHaveBeenCalledTimes(1);
    expect(onFinishedEditing).toHaveBeenCalledWith(undefined, undefined);
  });

  it("confirms the text editor on Enter outside IME composition and moves down", () => {
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "draft",
        displayData: "draft",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "draft",
          displayData: "draft",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.change(editor, { target: { value: "confirmed" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onFinishedEditing).toHaveBeenCalledTimes(1);
    expect(onFinishedEditing).toHaveBeenCalledWith(
      expect.objectContaining({ data: "confirmed", displayData: "confirmed" }),
      [0, 1],
    );
  });

  it("does not confirm the text editor when Enter is part of IME composition", () => {
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.keyDown(editor, { key: "Enter", isComposing: true });
    fireEvent.keyDown(editor, { key: "Process", keyCode: 229 });

    expect(onFinishedEditing).not.toHaveBeenCalled();
  });

  it("confirms the text editor on Ctrl+Enter and emits a below shortcut", () => {
    const onInlineCommitRun = vi.fn();
    renderMatrixGridWithGroups([], onInlineCommitRun);

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [1, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.change(editor, { target: { value: "confirmed" } });
    const event = fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    expect(onFinishedEditing).toHaveBeenCalledTimes(1);
    expect(onFinishedEditing).toHaveBeenCalledWith(
      expect.objectContaining({ data: "confirmed", displayData: "confirmed" }),
      undefined,
    );
    expect(onInlineCommitRun).not.toHaveBeenCalled();
    dataEditorState.props?.onCellsEdited?.([
      {
        location: [0, 0],
        value: {
          kind: GridCellKind.Text,
          data: "confirmed",
          displayData: "confirmed",
          allowOverlay: true,
        },
      },
    ]);
    expect(onInlineCommitRun).toHaveBeenCalledWith({
      sourceRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      prompt: "confirmed",
      direction: "below",
    });
    expect(event).toBe(false);
  });

  it("confirms the text editor on Ctrl+Shift+Enter and emits a right shortcut", () => {
    const onInlineCommitRun = vi.fn();
    renderMatrixGridWithGroups([], onInlineCommitRun);

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [1, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.change(editor, { target: { value: "confirmed right" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true, shiftKey: true });

    expect(onFinishedEditing).toHaveBeenCalledTimes(1);
    expect(onFinishedEditing).toHaveBeenCalledWith(
      expect.objectContaining({ data: "confirmed right", displayData: "confirmed right" }),
      undefined,
    );
    expect(onInlineCommitRun).not.toHaveBeenCalled();
    dataEditorState.props?.onCellsEdited?.([
      {
        location: [0, 0],
        value: {
          kind: GridCellKind.Text,
          data: "confirmed right",
          displayData: "confirmed right",
          allowOverlay: true,
        },
      },
    ]);
    expect(onInlineCommitRun).toHaveBeenCalledWith({
      sourceRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      prompt: "confirmed right",
      direction: "right",
    });
  });

  it("does not commit or run on Ctrl+Alt+Enter", () => {
    const dispatchEventSpy = vi.spyOn(document, "dispatchEvent");
    renderMatrixGrid();

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [0, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.change(editor, { target: { value: "alt" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true, altKey: true });

    expect(onFinishedEditing).not.toHaveBeenCalled();
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it("flushes the inline request after the matching cell commit", () => {
    const order: string[] = [];
    const onCellEdited = vi.fn(() => order.push("commit"));
    const onInlineCommitRun = vi.fn(() => order.push("run"));

    render(
      <MatrixGrid
        document={createEmptyMatrixDocument({ withResearchTemplate: false })}
        groups={[]}
        selection={null}
        editingGroupId={null}
        groupLabelDraft=""
        onCellClick={vi.fn()}
        onCellEdited={onCellEdited}
        onCellsEdited={vi.fn(() => order.push("commit"))}
        onInlineCommitRun={onInlineCommitRun}
        onGroupLabelDraftChange={vi.fn()}
        onGroupLabelSave={vi.fn()}
        onGroupLabelCancel={vi.fn()}
        onSelectionChange={vi.fn()}
      />,
    );

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [3, 10],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.change(editor, { target: { value: "edited source" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    expect(onFinishedEditing).toHaveBeenCalledTimes(1);
    expect(onInlineCommitRun).not.toHaveBeenCalled();

    dataEditorState.props?.onCellsEdited?.([
      {
        location: [2, 10],
        value: {
          kind: GridCellKind.Text,
          data: "edited source",
          displayData: "edited source",
          allowOverlay: true,
        },
      },
    ]);

    expect(order).toEqual(["commit", "run"]);
    expect(onInlineCommitRun).toHaveBeenCalledWith({
      sourceRange: { startRow: 10, startCol: 2, endRow: 10, endCol: 2 },
      prompt: "edited source",
      direction: "below",
    });
  });

  it("keeps a composing shortcut pending and flushes the final IME value once", () => {
    const onInlineCommitRun = vi.fn();

    render(
      <MatrixGrid
        document={createEmptyMatrixDocument({ withResearchTemplate: false })}
        groups={[]}
        selection={null}
        editingGroupId={null}
        groupLabelDraft=""
        onCellClick={vi.fn()}
        onCellEdited={vi.fn()}
        onCellsEdited={vi.fn()}
        onInlineCommitRun={onInlineCommitRun}
        onGroupLabelDraftChange={vi.fn()}
        onGroupLabelSave={vi.fn()}
        onGroupLabelCancel={vi.fn()}
        onSelectionChange={vi.fn()}
      />,
    );

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [3, 10],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.compositionStart(editor);
    fireEvent.change(editor, { target: { value: "안녕하세요" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true, isComposing: true });

    expect(onFinishedEditing).not.toHaveBeenCalled();
    expect(onInlineCommitRun).not.toHaveBeenCalled();

    fireEvent.compositionEnd(editor, { data: "안녕하세요", target: { value: "안녕하세요" } });
    expect(onFinishedEditing).toHaveBeenCalledTimes(1);
    expect(onInlineCommitRun).not.toHaveBeenCalled();

    dataEditorState.props?.onCellsEdited?.([
      {
        location: [2, 10],
        value: {
          kind: GridCellKind.Text,
          data: "안녕하세요",
          displayData: "안녕하세요",
          allowOverlay: true,
        },
      },
    ]);

    expect(onInlineCommitRun).toHaveBeenCalledTimes(1);
    expect(onInlineCommitRun).toHaveBeenCalledWith({
      sourceRange: { startRow: 10, startCol: 2, endRow: 10, endCol: 2 },
      prompt: "안녕하세요",
      direction: "below",
    });
  });

  it("does not defer a shortcut just because the IME keyCode is 229", () => {
    const onInlineCommitRun = vi.fn();
    renderMatrixGridWithGroups([], onInlineCommitRun);

    const TextEditor = getTextEditor(
      dataEditorState.props?.provideEditor?.({
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        location: [1, 0],
      }) as ProvideEditorCallbackResult<TextCell>,
    );
    const onFinishedEditing = vi.fn();

    render(
      <TextEditor
        isHighlighted={false}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
        value={{
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          allowOverlay: true,
        }}
        target={{ x: 0, y: 0, width: 100, height: 32 }}
        forceEditMode={false}
        theme={{} as never}
      />,
    );

    const editor = screen.getByLabelText("Matrix cell editor");
    fireEvent.change(editor, { target: { value: "완료" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true, keyCode: 229 });

    expect(onFinishedEditing).toHaveBeenCalledTimes(1);
    expect(onInlineCommitRun).not.toHaveBeenCalled();
    dataEditorState.props?.onCellsEdited?.([
      {
        location: [0, 0],
        value: {
          kind: GridCellKind.Text,
          data: "완료",
          displayData: "완료",
          allowOverlay: true,
        },
      },
    ]);
    expect(onInlineCommitRun).toHaveBeenCalledWith({
      sourceRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      prompt: "완료",
      direction: "below",
    });
  });
});
