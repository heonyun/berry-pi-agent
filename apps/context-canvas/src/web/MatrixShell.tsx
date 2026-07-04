import type { PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from "react";

export interface MatrixShellProps {
  readonly leftNav: ReactNode;
  readonly center: ReactNode;
  readonly detailPane: ReactNode;
  readonly leftCollapsed: boolean;
  readonly rightCollapsed: boolean;
  readonly leftPeeked?: boolean;
  readonly rightPeeked?: boolean;
  readonly onToggleLeft: () => void;
  readonly onToggleRight: () => void;
  readonly onLeftPeekChange?: (peeked: boolean) => void;
  readonly onRightPeekChange?: (peeked: boolean) => void;
}

function isHoverPeekPointer(event: ReactPointerEvent<HTMLElement>): boolean {
  // CONTRACT: touch devices stay toggle-only for #118; hover peek is pointer-hover UX.
  return event.pointerType !== "touch";
}

export function MatrixShell({
  leftNav,
  center,
  detailPane,
  leftCollapsed,
  rightCollapsed,
  leftPeeked = false,
  rightPeeked = false,
  onToggleLeft,
  onToggleRight,
  onLeftPeekChange,
  onRightPeekChange,
}: MatrixShellProps): ReactElement {
  const isLeftPeeked = leftCollapsed && leftPeeked;
  const isRightPeeked = rightCollapsed && rightPeeked;

  return (
    <div className="matrix-canvas" data-testid="matrix-shell">
      <aside
        className={`matrix-panel-shell matrix-left-panel${leftCollapsed ? " collapsed" : ""}${isLeftPeeked ? " peeked" : ""}`}
        data-testid="matrix-left-panel"
        data-collapsed={leftCollapsed ? "true" : "false"}
        data-peeked={isLeftPeeked ? "true" : "false"}
        onPointerEnter={(event) =>
          leftCollapsed && isHoverPeekPointer(event) && onLeftPeekChange?.(true)
        }
        onPointerLeave={(event) =>
          leftCollapsed && isHoverPeekPointer(event) && onLeftPeekChange?.(false)
        }
      >
        <button
          type="button"
          className="matrix-panel-toggle"
          data-testid="matrix-left-panel-toggle"
          aria-label={leftCollapsed ? "Show groups/history panel" : "Collapse groups/history panel"}
          title={leftCollapsed ? "Show groups/history panel" : "Collapse groups/history panel"}
          onClick={onToggleLeft}
        >
          <span aria-hidden="true">{leftCollapsed ? ">" : "<"}</span>
        </button>
        <div
          className="matrix-panel-rail"
          data-testid="matrix-left-panel-rail"
          aria-hidden={!leftCollapsed || isLeftPeeked}
        >
          <span className="matrix-panel-rail-icon" aria-hidden="true">
            G
          </span>
          <span className="matrix-panel-rail-icon" aria-hidden="true">
            H
          </span>
        </div>
        <div className="matrix-panel-content" aria-hidden={leftCollapsed && !isLeftPeeked}>
          {leftNav}
        </div>
      </aside>
      <div className="matrix-center">{center}</div>
      <aside
        className={`matrix-panel-shell matrix-right-panel${rightCollapsed ? " collapsed" : ""}${isRightPeeked ? " peeked" : ""}`}
        data-testid="matrix-right-panel"
        data-collapsed={rightCollapsed ? "true" : "false"}
        data-peeked={isRightPeeked ? "true" : "false"}
        onPointerEnter={(event) =>
          rightCollapsed && isHoverPeekPointer(event) && onRightPeekChange?.(true)
        }
        onPointerLeave={(event) =>
          rightCollapsed && isHoverPeekPointer(event) && onRightPeekChange?.(false)
        }
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
        <div
          className="matrix-panel-rail"
          data-testid="matrix-right-panel-rail"
          aria-hidden={!rightCollapsed || isRightPeeked}
        >
          <span className="matrix-panel-rail-icon" aria-hidden="true">
            I
          </span>
        </div>
        <div className="matrix-panel-content" aria-hidden={rightCollapsed && !isRightPeeked}>
          {detailPane}
        </div>
      </aside>
    </div>
  );
}
