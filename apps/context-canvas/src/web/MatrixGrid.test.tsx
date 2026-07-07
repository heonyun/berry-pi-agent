/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  GridCellKind,
  type DataEditorProps,
  type ProvideEditorCallbackResult,
  type TextCell,
} from "@glideapps/glide-data-grid";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyMatrixDocument } from "../shared/domain.ts";
import { MatrixGrid } from "./MatrixGrid.tsx";

const dataEditorState = vi.hoisted(() => ({
  props: null as DataEditorProps | null,
}));

vi.mock("@glideapps/glide-data-grid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@glideapps/glide-data-grid")>();
  return {
    ...actual,
    DataEditor: vi.fn((props: DataEditorProps) => {
      dataEditorState.props = props;
      return <div data-testid="mock-data-editor" />;
    }),
  };
});

afterEach(() => {
  cleanup();
  dataEditorState.props = null;
});

function renderMatrixGrid(): void {
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
      onGroupLabelDraftChange={vi.fn()}
      onGroupLabelSave={vi.fn()}
      onGroupLabelCancel={vi.fn()}
      onSelectionChange={vi.fn()}
    />,
  );
}

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

  it("does not confirm the text editor on Ctrl+Enter", () => {
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
    const event = fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    expect(onFinishedEditing).not.toHaveBeenCalled();
    expect(event).toBe(false);
  });
});
