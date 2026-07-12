// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixComposer, type MatrixComposerProps } from "./MatrixComposer.tsx";

function renderComposer(overrides: Partial<MatrixComposerProps> = {}) {
  const props: MatrixComposerProps = {
    contextChips: [],
    targetLabel: null,
    selectionLabel: "B10",
    selectionSummary: "B10",
    selectionIsMultiCell: false,
    prompt: "",
    rangeNameInput: "",
    isRunning: false,
    canRun: false,
    showAiSection: true,
    onPromptChange: vi.fn(),
    onRangeNameChange: vi.fn(),
    onAddContext: vi.fn(),
    onRemoveContext: vi.fn(),
    onMoveContextUp: vi.fn(),
    onSetTarget: vi.fn(),
    onSaveNamedRange: vi.fn(),
    onQuickSummarize: vi.fn(),
    onRun: vi.fn(),
    ...overrides,
  };

  render(<MatrixComposer {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
});

describe("MatrixComposer", () => {
  it("renders the AI command bar as the primary selection workflow", () => {
    renderComposer();

    expect(screen.getByLabelText("Selection B10")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Ask AI about this selection or type a command..."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
    for (const name of ["Summarize", "Compare", "2x2 Matrix", "Extract Criteria", "Expand", "More"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("keeps undefined quick actions disabled placeholders", () => {
    renderComposer();

    for (const name of ["Compare", "2x2 Matrix", "Extract Criteria", "Expand", "More"]) {
      expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
    }
  });

  it("enables Send when selection and prompt are ready without an explicit target", () => {
    renderComposer({
      canRun: true,
      selectionLabel: "B6",
      selectionSummary: "B6",
      prompt: "summarize",
    });

    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", false);
  });

  // RELATED: issue-148 — document capture owns inferred-target dispatch.
  it("does not dispatch inferred-target shortcuts through the generic composer run callback", () => {
    const props = renderComposer({
      canRun: true,
      prompt: "answer",
    });
    const input = screen.getByTestId("matrix-composer-input");

    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    expect(props.onRun).not.toHaveBeenCalled();
  });
});
