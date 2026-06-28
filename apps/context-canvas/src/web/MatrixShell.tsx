import type { ReactElement, ReactNode } from "react";

export interface MatrixShellProps {
  readonly leftNav: ReactNode;
  readonly center: ReactNode;
  readonly detailPane: ReactNode;
}

export function MatrixShell({ leftNav, center, detailPane }: MatrixShellProps): ReactElement {
  return (
    <div className="matrix-canvas" data-testid="matrix-shell">
      {leftNav}
      <div className="matrix-center">{center}</div>
      {detailPane}
    </div>
  );
}
