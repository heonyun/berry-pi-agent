import type { ReactElement } from "react";
import type { RangeRefDTO } from "../shared/domain.ts";

export interface ContextChip {
  readonly id: string;
  readonly label: string;
  readonly range: RangeRefDTO;
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
  readonly hasTarget: boolean;
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
  hasTarget,
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
    <footer className="bottom-composer matrix-composer" data-testid="matrix-composer">
      {selectionSummary && (
        <div className="matrix-name-box" data-testid="matrix-name-box">
          <span className="matrix-name-box-label">Selection</span>
          <span className="matrix-name-box-value">{selectionSummary}</span>
        </div>
      )}

      {selectionIsMultiCell && selectionSummary && (
        <p className="matrix-ai-range-hint" data-testid="matrix-ai-range-hint">
          Selected range — use + Context or Set target below
        </p>
      )}

      {showAiSection && (
        <>
          <div className="matrix-composer-section-label">AI (optional)</div>
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
            {targetLabel && (
              <span className="matrix-target-chip" data-testid="target-range-chip">
                target: {targetLabel}
              </span>
            )}
          </div>

          <div className="matrix-composer-bar">
            <input
              className="matrix-composer-input nodrag nopan"
              type="text"
              placeholder={
                targetLabel
                  ? `Apply AI to ${targetLabel}...`
                  : "Set target range, add context, then run AI..."
              }
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              disabled={isRunning}
              data-testid="matrix-composer-input"
            />

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
              Summarize selection
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

            <button
              type="button"
              className="matrix-composer-run nodrag nopan"
              disabled={!hasTarget || !prompt.trim() || isRunning}
              onClick={onRun}
              data-testid="matrix-run"
            >
              {isRunning ? "Running..." : "Run"}
            </button>
          </div>
        </>
      )}

      <div className="matrix-composer-hint">
        Type in cells · drag to select a range
        {showAiSection ? " · optional AI below" : " · add cell content or select a range for AI"}
        {selectionSummary && (
          <span data-testid="matrix-selection-hint"> · selection: {selectionSummary}</span>
        )}
      </div>
    </footer>
  );
}
