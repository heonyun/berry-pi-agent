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
  readonly prompt: string;
  readonly rangeNameInput: string;
  readonly isRunning: boolean;
  readonly hasTarget: boolean;
  readonly onPromptChange: (value: string) => void;
  readonly onRangeNameChange: (value: string) => void;
  readonly onAddContext: () => void;
  readonly onRemoveContext: (chipId: string) => void;
  readonly onMoveContextUp: (chipId: string) => void;
  readonly onSetTarget: () => void;
  readonly onSaveNamedRange: () => void;
  readonly onRun: () => void;
}

export function MatrixComposer({
  contextChips,
  targetLabel,
  selectionLabel,
  prompt,
  rangeNameInput,
  isRunning,
  hasTarget,
  onPromptChange,
  onRangeNameChange,
  onAddContext,
  onRemoveContext,
  onMoveContextUp,
  onSetTarget,
  onSaveNamedRange,
  onRun,
}: MatrixComposerProps): ReactElement {
  return (
    <footer className="bottom-composer matrix-composer" data-testid="matrix-composer">
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
          onClick={onAddContext}
          data-testid="matrix-add-context"
        >
          + Context
        </button>

        <button
          type="button"
          className="matrix-target-set-button nodrag nopan"
          disabled={!selectionLabel || isRunning}
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
      <div className="matrix-composer-hint">
        Select range · + Context / Set target · name optionally · Run → POST /api/matrix-run
        {selectionLabel && <span> · selection: {selectionLabel}</span>}
      </div>
    </footer>
  );
}
