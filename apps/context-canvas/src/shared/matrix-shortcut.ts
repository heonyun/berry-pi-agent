import type { MatrixTargetDirection } from "./matrix-target-inference.ts";

/** Keyboard probe for matrix Ctrl+Enter / Ctrl+Shift+Enter shortcuts. */
export interface MatrixShortcutKeyProbe {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly isComposing?: boolean;
}

export type MatrixUndoRedoShortcutAction = "undo" | "redo";

/**
 * CONTRACT: returns inferred target direction for matrix AI shortcut, or null when not a shortcut key.
 * WHY: Ctrl+Enter infers below; Ctrl+Shift+Enter infers right (#78).
 */
export function matrixShortcutDirection(probe: MatrixShortcutKeyProbe): MatrixTargetDirection | null {
  if (probe.key !== "Enter" || (!probe.ctrlKey && !probe.metaKey) || probe.altKey) {
    return null;
  }
  return probe.shiftKey ? "right" : "below";
}

export function matrixUndoRedoShortcutAction(
  probe: MatrixShortcutKeyProbe,
): MatrixUndoRedoShortcutAction | null {
  if (probe.isComposing || probe.altKey || (!probe.ctrlKey && !probe.metaKey)) {
    return null;
  }
  const key = probe.key.toLowerCase();
  if (key === "z") {
    return probe.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && !probe.shiftKey) {
    return "redo";
  }
  return null;
}

function isMatrixShellElement(target: Element): boolean {
  return Boolean(target.closest('[data-testid="matrix-shell"]'));
}

/**
 * CONTRACT: true when document-level shortcut handler should run AI for this focus target.
 * INVARIANT: never handle while Glide overlay `.gdg-input` is active — edit-on-type conflicts (#94).
 */
export function shouldHandleMatrixShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest('[data-testid="matrix-composer-input"]')) {
    return true;
  }
  // WHY: detail markdown edit is not grid cell edit; user expects Ctrl+Enter to run AI (#94).
  if (target.closest('[data-testid="matrix-detail-pane"] textarea')) {
    return true;
  }
  if (target.closest(".gdg-input")) {
    return false;
  }
  if (
    target.closest(
      '[data-testid="matrix-group-label-input"], [data-testid="matrix-column-label-input"]',
    )
  ) {
    return false;
  }
  if (target.closest("textarea, input, button, [contenteditable]:not([contenteditable='false'])")) {
    return false;
  }
  return Boolean(target.closest('[data-testid="matrix-grid"]'));
}

export function shouldHandleMatrixUndoRedoShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest(".gdg-input")) {
    return false;
  }
  if (target.closest("textarea, input, [contenteditable]:not([contenteditable='false'])")) {
    return false;
  }
  return isMatrixShellElement(target);
}

/**
 * CONTRACT: user-visible status when shortcut key is pressed inside matrix shell but focus blocks run.
 * RELATED: issue-94, matrix-shortcut.test.ts
 */
export function matrixShortcutBlockedStatus(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target.closest(".gdg-input")) {
    // WHY: the active Glide overlay editor now handles commit-then-run inline.
    return null;
  }
  if (!isMatrixShellElement(target)) {
    return null;
  }
  if (shouldHandleMatrixShortcut(target)) {
    return null;
  }
  if (
    target.closest(
      '[data-testid="matrix-group-label-input"], [data-testid="matrix-column-label-input"]',
    )
  ) {
    return "Finish renaming before Ctrl+Enter";
  }
  return "Focus the grid or AI prompt field, then Ctrl+Enter";
}
