import type { ReactElement } from "react";
import { formatRangeLabel, type MatrixGroup } from "../shared/domain.ts";

export interface MatrixGroupNavProps {
  readonly groups: readonly MatrixGroup[];
  readonly selectedGroupId: string | null;
  readonly onSelect: (group: MatrixGroup) => void;
  readonly onAddContext: (group: MatrixGroup) => void;
  readonly onDismiss: (group: MatrixGroup) => void;
}

export function MatrixGroupNav({
  groups,
  selectedGroupId,
  onSelect,
  onAddContext,
  onDismiss,
}: MatrixGroupNavProps): ReactElement {
  return (
    <section className="matrix-left-nav-section" data-testid="matrix-group-nav" aria-label="Groups">
      <h2 className="matrix-left-nav-title">Groups</h2>
      {groups.length === 0 ? (
        <p className="matrix-left-nav-empty">Adjacent filled cells will appear here as groups.</p>
      ) : (
        <ul className="matrix-group-list">
          {groups.map((group) => {
            const rangeLabel = formatRangeLabel(
              group.range.startCol,
              group.range.startRow,
              group.range.endCol,
              group.range.endRow,
            );
            const selected = group.id === selectedGroupId;
            return (
              <li key={group.id}>
                <button
                  type="button"
                  className={`matrix-group-item nodrag nopan${selected ? " active" : ""}`}
                  data-testid={`matrix-group-${group.id}`}
                  onClick={() => onSelect(group)}
                >
                  <span className="matrix-group-name">{group.label}</span>
                  <span className="matrix-group-label">{rangeLabel}</span>
                </button>
                <div className="matrix-group-actions">
                  <button
                    type="button"
                    className="matrix-group-action"
                    data-testid={`matrix-group-context-${group.id}`}
                    onClick={() => onAddContext(group)}
                  >
                    {/* WHY: Auto groups enter LLM context only through this explicit user action. */}
                    + Context
                  </button>
                  <button
                    type="button"
                    className="matrix-group-action"
                    data-testid={`matrix-group-hide-${group.id}`}
                    onClick={() => onDismiss(group)}
                    aria-label={`Hide ${group.label}`}
                  >
                    Hide
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
