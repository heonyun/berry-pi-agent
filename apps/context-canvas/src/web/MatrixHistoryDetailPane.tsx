import type { ReactElement } from "react";
import type { MatrixHistoryEntry } from "../shared/domain.ts";
import { formatCellCount, formatHistoryTimestamp } from "./matrix-history.ts";

export interface MatrixHistoryDetailPaneProps {
  readonly entry: MatrixHistoryEntry;
  readonly onClose: () => void;
  readonly onRerun: (entry: MatrixHistoryEntry) => void;
}

export function MatrixHistoryDetailPane({
  entry,
  onClose,
  onRerun,
}: MatrixHistoryDetailPaneProps): ReactElement {
  return (
    <aside className="matrix-detail-pane matrix-history-detail" data-testid="matrix-history-detail">
      <div className="matrix-history-detail-header">
        <h2 className="matrix-history-detail-title">Run history</h2>
        <button
          type="button"
          className="matrix-history-detail-close nodrag nopan"
          data-testid="history-detail-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <dl className="matrix-history-detail-fields">
        <div>
          <dt>Intent</dt>
          <dd data-testid="history-detail-intent">{entry.intent || "(empty)"}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{formatHistoryTimestamp(entry.timestamp)}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd data-testid="history-detail-cells">{formatCellCount(entry.patchesApplied)}</dd>
        </div>
        <div>
          <dt>Context ranges</dt>
          <dd>
            {entry.contextRangeNames.length > 0 ? entry.contextRangeNames.join(", ") : "(none)"}
          </dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{entry.targetRangeLabel}</dd>
        </div>
        {entry.patchesSummary && (
          <div>
            <dt>Patches</dt>
            <dd data-testid="history-detail-patches">{entry.patchesSummary}</dd>
          </div>
        )}
        {entry.compiledContextPreview && (
          <div>
            <dt>Compiled context</dt>
            <dd>
              <pre className="matrix-history-preview" data-testid="history-detail-context">
                {entry.compiledContextPreview}
              </pre>
            </dd>
          </div>
        )}
      </dl>

      <div className="matrix-history-detail-actions">
        <button
          type="button"
          className="matrix-history-rerun nodrag nopan"
          data-testid="history-detail-rerun"
          onClick={() => onRerun(entry)}
        >
          Re-run (pre-fill composer)
        </button>
      </div>
    </aside>
  );
}
