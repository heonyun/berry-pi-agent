import type { ReactElement } from "react";
import type { MatrixHistoryEntry } from "../shared/domain.ts";
import { formatCellCount, formatHistoryTimestamp } from "./matrix-history.ts";

export interface MatrixHistoryNavProps {
  readonly entries: readonly MatrixHistoryEntry[];
  readonly selectedId: string | null;
  readonly onSelect: (entry: MatrixHistoryEntry) => void;
}

export function MatrixHistoryNav({
  entries,
  selectedId,
  onSelect,
}: MatrixHistoryNavProps): ReactElement {
  return (
    <section className="matrix-left-nav-section" data-testid="matrix-history-nav" aria-label="Run history">
      <h2 className="matrix-left-nav-title">History</h2>
      {entries.length === 0 ? (
        <p className="matrix-left-nav-empty">No runs yet. Complete a matrix AI run.</p>
      ) : (
        <ul className="matrix-history-list" data-testid="history-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`matrix-history-item nodrag nopan${selectedId === entry.id ? " active" : ""}`}
                data-testid={`history-entry-${entry.id}`}
                onClick={() => onSelect(entry)}
              >
                <span className="matrix-history-intent">{entry.intent || "(no intent)"}</span>
                <span className="matrix-history-meta">
                  {formatHistoryTimestamp(entry.timestamp)} · {formatCellCount(entry.patchesApplied)}
                </span>
                <span className="matrix-history-ranges">
                  {entry.contextRangeNames.length > 0
                    ? `ctx: ${entry.contextRangeNames.join(", ")}`
                    : "no context ranges"}{" "}
                  → {entry.targetRangeLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
