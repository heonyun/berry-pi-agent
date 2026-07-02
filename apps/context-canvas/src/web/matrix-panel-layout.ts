export const MATRIX_LEFT_PANEL_COLLAPSED_KEY = "context-matrix-left-panel-collapsed";
export const MATRIX_RIGHT_PANEL_COLLAPSED_KEY = "context-matrix-right-panel-collapsed";

function readBooleanStorage(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeBooleanStorage(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

export function loadMatrixPanelLayout(): {
  readonly leftCollapsed: boolean;
  readonly rightCollapsed: boolean;
} {
  return {
    leftCollapsed: readBooleanStorage(MATRIX_LEFT_PANEL_COLLAPSED_KEY),
    rightCollapsed: readBooleanStorage(MATRIX_RIGHT_PANEL_COLLAPSED_KEY),
  };
}

export function saveMatrixPanelLayout(layout: {
  readonly leftCollapsed: boolean;
  readonly rightCollapsed: boolean;
}): void {
  writeBooleanStorage(MATRIX_LEFT_PANEL_COLLAPSED_KEY, layout.leftCollapsed);
  writeBooleanStorage(MATRIX_RIGHT_PANEL_COLLAPSED_KEY, layout.rightCollapsed);
}
