import type { ReactElement, ReactNode } from "react";

export interface MatrixShellProps {
  readonly leftNav: ReactNode;
  readonly center: ReactNode;
  readonly detailPane: ReactNode;
  readonly leftCollapsed: boolean;
  readonly rightCollapsed: boolean;
  readonly onToggleLeft: () => void;
  readonly onToggleRight: () => void;
}

export function MatrixShell({
  leftNav,
  center,
  detailPane,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
}: MatrixShellProps): ReactElement {
  return (
    <div className="matrix-canvas" data-testid="matrix-shell">
      <aside
        className={`matrix-panel-shell matrix-left-panel${leftCollapsed ? " collapsed" : ""}`}
        data-testid="matrix-left-panel"
        data-collapsed={leftCollapsed ? "true" : "false"}
      >
        <button
          type="button"
          className="matrix-panel-toggle"
          data-testid="matrix-left-panel-toggle"
          aria-label={leftCollapsed ? "Show recent/history panel" : "Collapse recent/history panel"}
          title={leftCollapsed ? "Show recent/history panel" : "Collapse recent/history panel"}
          onClick={onToggleLeft}
        >
          <span aria-hidden="true">{leftCollapsed ? ">" : "<"}</span>
        </button>
        <div className="matrix-panel-content" aria-hidden={leftCollapsed}>
          {leftNav}
        </div>
      </aside>
      <div className="matrix-center">{center}</div>
      <aside
        className={`matrix-panel-shell matrix-right-panel${rightCollapsed ? " collapsed" : ""}`}
        data-testid="matrix-right-panel"
        data-collapsed={rightCollapsed ? "true" : "false"}
      >
        <button
          type="button"
          className="matrix-panel-toggle"
          data-testid="matrix-right-panel-toggle"
          aria-label={rightCollapsed ? "Show detail panel" : "Collapse detail panel"}
          title={rightCollapsed ? "Show detail panel" : "Collapse detail panel"}
          onClick={onToggleRight}
        >
          <span aria-hidden="true">{rightCollapsed ? "<" : ">"}</span>
        </button>
        <div className="matrix-panel-content" aria-hidden={rightCollapsed}>
          {detailPane}
        </div>
      </aside>
    </div>
  );
}
