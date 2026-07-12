import type { ReactElement } from "react";
import type { RangeRefDTO } from "../shared/domain.ts";

export interface ContextChip {
  readonly id: string;
  readonly label: string;
  readonly range: RangeRefDTO;
  readonly groupId?: string;
}

export interface MatrixComposerProps {
  readonly contextChips: readonly ContextChip[];
  readonly targetLabel: string | null;
  readonly selectionLabel: string | null;
  readonly selectionSummary: string | null;
  readonly selectionIsMultiCell: boolean;
  readonly prompt: string;
  readonly rangeNameInput: string;
  readonly isRunning: boolean;
  /** True when Send can run: selection or explicit target plus a non-empty prompt. */
  readonly canRun: boolean;
  readonly showAiSection: boolean;
  readonly onPromptChange: (value: string) => void;
  readonly onRangeNameChange: (value: string) => void;
  readonly onAddContext: () => void;
  readonly onRemoveContext: (chipId: string) => void;
  readonly onMoveContextUp: (chipId: string) => void;
  readonly onSetTarget: () => void;
  readonly onSaveNamedRange: () => void;
  readonly onQuickSummarize: () => void;
  readonly onRun: () => void;
}

export function MatrixComposer({
  contextChips,
  targetLabel,
  selectionLabel,
  selectionSummary,
  selectionIsMultiCell,
  prompt,
  rangeNameInput,
  isRunning,
  canRun,
  showAiSection,
  onPromptChange,
  onRangeNameChange,
  onAddContext,
  onRemoveContext,
  onMoveContextUp,
  onSetTarget,
  onSaveNamedRange,
  onQuickSummarize,
  onRun,
}: MatrixComposerProps): ReactElement {
  return (
    <footer className="matrix-composer" data-testid="matrix-composer">
      {selectionIsMultiCell && selectionSummary && (
        <p className="matrix-ai-range-hint" data-testid="matrix-ai-range-hint">
          Selected range — use + Context or Set target below
        </p>
      )}

      {showAiSection && (
        <>
          <div className="matrix-composer-header">
            <div
              className="matrix-name-box"
              data-testid="matrix-name-box"
              aria-label={`Selection ${selectionSummary ?? "None"}`}
            >
              <span className="matrix-name-box-label">Selection</span>
              <span className="matrix-name-box-value">{selectionSummary ?? "None"}</span>
            </div>
            {targetLabel && (
              <span className="matrix-target-chip" data-testid="target-range-chip">
                target: {targetLabel}
              </span>
            )}
          </div>

          {contextChips.length > 0 && (
            <div className="matrix-chip-row">
              {contextChips.map((chip, index) => (
                <span
                  key={chip.id}
                  className="matrix-context-chip"
                  data-testid={`context-chip-${chip.label.replace(/^@/, "")}`}
                >
                  ctx: {chip.label}
                  {index > 0 && (
                    <button
                      type="button"
                      className="matrix-chip-reorder nodrag nopan"
                      aria-label={`Move ${chip.label} up`}
                      onClick={() => onMoveContextUp(chip.id)}
                    >
                      ↑
                    </button>
                  )}
                  <button
                    type="button"
                    className="matrix-chip-remove nodrag nopan"
                    aria-label={`Remove context ${chip.label}`}
                    onClick={() => onRemoveContext(chip.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="matrix-composer-prompt-row">
            <input
              className="matrix-composer-input nodrag nopan"
              type="text"
              placeholder="Ask AI about this selection or type a command..."
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !event.repeat &&
                  !event.nativeEvent.isComposing &&
                  canRun &&
                  !isRunning
                ) {
                  event.preventDefault();
                  // INVARIANT: document capture owns inferred-target dispatch; prevent a duplicate composer run.
                  event.stopPropagation();
                  onRun();
                }
              }}
              disabled={isRunning}
              data-testid="matrix-composer-input"
            />
            <button
              type="button"
              className="matrix-composer-run nodrag nopan"
              disabled={!canRun || isRunning}
              onClick={onRun}
              data-testid="matrix-run"
            >
              {isRunning ? "Running..." : "Send"}
            </button>
          </div>

          <div className="matrix-composer-quick-actions">
            <button
              type="button"
              className="matrix-quick-summarize-button nodrag nopan"
              disabled={!selectionLabel || isRunning}
              title={
                selectionLabel
                  ? "Add selection as context and target, pre-fill summarize prompt"
                  : "Select a range on the grid first"
              }
              onClick={onQuickSummarize}
              data-testid="matrix-quick-summarize"
            >
              Summarize
            </button>
            <button type="button" className="matrix-quick-action-button nodrag nopan" disabled>
              Compare
            </button>
            <button type="button" className="matrix-quick-action-button nodrag nopan" disabled>
              2x2 Matrix
            </button>
            <button type="button" className="matrix-quick-action-button nodrag nopan" disabled>
              Extract Criteria
            </button>
            <button type="button" className="matrix-quick-action-button nodrag nopan" disabled>
              Expand
            </button>
            <button type="button" className="matrix-quick-action-button nodrag nopan" disabled>
              More
            </button>
          </div>

          <div className="matrix-composer-secondary">
            <button
              type="button"
              className="matrix-context-add-button nodrag nopan"
              disabled={!selectionLabel || isRunning}
              title={selectionLabel ? undefined : "Select a range on the grid first"}
              onClick={onAddContext}
              data-testid="matrix-add-context"
            >
              + Context
            </button>
            <button
              type="button"
              className="matrix-target-set-button nodrag nopan"
              disabled={!selectionLabel || isRunning}
              title={selectionLabel ? undefined : "Select a range on the grid first"}
              onClick={onSetTarget}
              data-testid="matrix-set-target"
            >
              Set target
            </button>
            <input
              className="matrix-range-name-input nodrag nopan"
              type="text"
              placeholder="name range"
              value={rangeNameInput}
              onChange={(event) => onRangeNameChange(event.target.value)}
              disabled={!selectionLabel}
              data-testid="matrix-range-name-input"
            />
            <button
              type="button"
              className="matrix-name-range-button nodrag nopan"
              disabled={!selectionLabel || !rangeNameInput.trim()}
              onClick={onSaveNamedRange}
              data-testid="matrix-name-range"
            >
              Name
            </button>
          </div>
        </>
      )}

      <div className="matrix-composer-hint">
        Type in cells · drag to select a range
        {showAiSection ? " · use the AI command bar below" : " · add cell content or select a range for AI"}
        {selectionSummary && (
          <span data-testid="matrix-selection-hint"> · selection: {selectionSummary}</span>
        )}
      </div>
    </footer>
  );
}
