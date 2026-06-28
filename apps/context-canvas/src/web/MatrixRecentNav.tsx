import type { ReactElement } from "react";
import type { RecentRangeEntry } from "../shared/domain.ts";

export interface MatrixRecentNavProps {
  readonly entries: readonly RecentRangeEntry[];
  readonly onSelect: (entry: RecentRangeEntry) => void;
}

export function MatrixRecentNav({ entries, onSelect }: MatrixRecentNavProps): ReactElement {
  return (
    <nav className="matrix-left-nav" data-testid="matrix-recent-nav" aria-label="Recent ranges">
      <h2 className="matrix-left-nav-title">Recent Ranges</h2>
      {entries.length === 0 ? (
        <p className="matrix-left-nav-empty">No recent ranges yet. Name a range or run AI.</p>
      ) : (
        <ul className="matrix-recent-list">
          {entries.map((entry) => (
            <li key={entry.name}>
              <button
                type="button"
                className="matrix-recent-item nodrag nopan"
                data-testid={`recent-range-${entry.name}`}
                onClick={() => onSelect(entry)}
              >
                <span className="matrix-recent-name">{entry.name}</span>
                <span className="matrix-recent-label">{entry.rangeLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
