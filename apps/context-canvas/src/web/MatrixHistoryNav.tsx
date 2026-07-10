import type { ReactElement } from "react";
import type { MatrixHistoryEntry } from "../shared/domain.ts";
import { formatHistoryOutcome, formatHistoryTimestamp } from "./matrix-history.ts";
import {
  exportMatrixSessionLogJson,
  isMatrixSessionLogEnabled,
} from "./matrix-session-log.ts";

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
  // WHY: dev testers need session log export without DevTools (#142).
  const sessionLogEnabled = isMatrixSessionLogEnabled();

  const handleCopySessionLog = async () => {
    const payload = exportMatrixSessionLogJson();
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      // Clipboard may be unavailable in non-secure contexts.
    }
  };

  return (
    <section className="matrix-left-nav-section" data-testid="matrix-history-nav" aria-label="Run history">
      <h2 className="matrix-left-nav-title">Recent Activity</h2>
      {sessionLogEnabled ? (
        <button
          type="button"
          className="matrix-history-export-log nodrag nopan"
          data-testid="matrix-session-log-export"
          onClick={() => void handleCopySessionLog()}
        >
          Copy session log
        </button>
      ) : null}
      {entries.length === 0 ? (
        <p className="matrix-left-nav-empty">No runs yet. Complete a matrix AI run.</p>
      ) : (
        <ul className="matrix-history-list" data-testid="history-list">
          {entries.map((entry) => {
            // CONTRACT: missing outcome means legacy success entries before #142.
            const outcome = entry.outcome ?? "success";
            return (
            <li key={entry.id}>
              <button
                type="button"
                className={`matrix-history-item nodrag nopan${selectedId === entry.id ? " active" : ""}${outcome !== "success" ? ` matrix-history-item--${outcome}` : ""}`}
                data-testid={`history-entry-${entry.id}`}
                data-outcome={outcome}
                onClick={() => onSelect(entry)}
              >
                <span className="matrix-history-intent">{entry.intent || "(no intent)"}</span>
                <span className="matrix-history-meta">
                  {formatHistoryTimestamp(entry.timestamp)} · {formatHistoryOutcome(entry)}
                </span>
                <span className="matrix-history-ranges">
                  {entry.contextRangeNames.length > 0
                    ? `ctx: ${entry.contextRangeNames.join(", ")}`
                    : "no context ranges"}{" "}
                  → {entry.targetRangeLabel}
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
