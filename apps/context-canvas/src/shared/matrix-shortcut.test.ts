import { describe, expect, it } from "vitest";
import {
  matrixUndoRedoShortcutAction,
  matrixShortcutBlockedStatus,
  matrixShortcutDirection,
  shouldHandleMatrixUndoRedoShortcut,
  shouldHandleMatrixShortcut,
} from "./matrix-shortcut.ts";

function el(html: string): Element {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild!;
}

describe("matrixShortcutDirection", () => {
  it("maps Ctrl+Enter to below and Ctrl+Shift+Enter to right", () => {
    expect(
      matrixShortcutDirection({
        key: "Enter",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe("below");
    expect(
      matrixShortcutDirection({
        key: "Enter",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
      }),
    ).toBe("right");
  });

  it("ignores plain Enter and Alt+Enter", () => {
    expect(
      matrixShortcutDirection({
        key: "Enter",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
    expect(
      matrixShortcutDirection({
        key: "Enter",
        ctrlKey: true,
        metaKey: false,
        altKey: true,
        shiftKey: false,
      }),
    ).toBeNull();
  });
});

describe("shouldHandleMatrixShortcut", () => {
  it("allows composer input and grid canvas", () => {
    const shell = el(`
      <div data-testid="matrix-shell">
        <input data-testid="matrix-composer-input" />
        <div data-testid="matrix-grid"><canvas data-testid="data-grid-canvas"></canvas></div>
      </div>
    `);
    expect(
      shouldHandleMatrixShortcut(shell.querySelector('[data-testid="matrix-composer-input"]')),
    ).toBe(true);
    expect(shouldHandleMatrixShortcut(shell.querySelector('[data-testid="data-grid-canvas"]'))).toBe(
      true,
    );
  });

  it("allows detail pane textarea but blocks glide overlay input", () => {
    const shell = el(`
      <div data-testid="matrix-shell">
        <aside data-testid="matrix-detail-pane"><textarea></textarea></aside>
        <div data-testid="matrix-grid"><input class="gdg-input" /></div>
      </div>
    `);
    expect(shouldHandleMatrixShortcut(shell.querySelector("textarea"))).toBe(true);
    expect(shouldHandleMatrixShortcut(shell.querySelector(".gdg-input"))).toBe(false);
  });

  it("blocks range name input", () => {
    const shell = el(`
      <div data-testid="matrix-shell">
        <input data-testid="matrix-range-name-input" />
      </div>
    `);
    expect(shouldHandleMatrixShortcut(shell.querySelector("input"))).toBe(false);
  });
});

describe("matrixShortcutBlockedStatus", () => {
  it("explains overlay edit block inside matrix shell", () => {
    const shell = el(`
      <div data-testid="matrix-shell">
        <div data-testid="matrix-grid"><input class="gdg-input" /></div>
      </div>
    `);
    expect(matrixShortcutBlockedStatus(shell.querySelector(".gdg-input"))).toMatch(
      /Finish cell edit/i,
    );
  });

  it("explains portal-mounted overlay edit block outside matrix shell", () => {
    const overlay = el(`<textarea class="gdg-input"></textarea>`);

    expect(matrixShortcutBlockedStatus(overlay)).toMatch(/Finish cell edit/i);
  });

  it("returns null outside matrix shell", () => {
    expect(matrixShortcutBlockedStatus(document.body)).toBeNull();
  });
});

describe("matrixUndoRedoShortcutAction", () => {
  it("maps standard undo and redo shortcuts", () => {
    expect(
      matrixUndoRedoShortcutAction({
        key: "z",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        isComposing: false,
      }),
    ).toBe("undo");
    expect(
      matrixUndoRedoShortcutAction({
        key: "y",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        isComposing: false,
      }),
    ).toBe("redo");
    expect(
      matrixUndoRedoShortcutAction({
        key: "Z",
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: true,
        isComposing: false,
      }),
    ).toBe("redo");
  });

  it("ignores composing, Alt-modified, and plain key presses", () => {
    expect(
      matrixUndoRedoShortcutAction({
        key: "z",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        isComposing: true,
      }),
    ).toBeNull();
    expect(
      matrixUndoRedoShortcutAction({
        key: "z",
        ctrlKey: true,
        metaKey: false,
        altKey: true,
        shiftKey: false,
        isComposing: false,
      }),
    ).toBeNull();
    expect(
      matrixUndoRedoShortcutAction({
        key: "z",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        isComposing: false,
      }),
    ).toBeNull();
  });
});

describe("shouldHandleMatrixUndoRedoShortcut", () => {
  it("allows matrix grid focus but blocks active text editors", () => {
    const shell = el(`
      <div data-testid="matrix-shell">
        <div data-testid="matrix-grid"><canvas data-testid="data-grid-canvas"></canvas></div>
        <aside data-testid="matrix-detail-pane"><textarea></textarea></aside>
        <button type="button">Matrix action</button>
        <input data-testid="matrix-group-label-input" />
      </div>
    `);
    expect(
      shouldHandleMatrixUndoRedoShortcut(shell.querySelector('[data-testid="data-grid-canvas"]')),
    ).toBe(true);
    expect(shouldHandleMatrixUndoRedoShortcut(shell.querySelector("textarea"))).toBe(false);
    expect(
      shouldHandleMatrixUndoRedoShortcut(shell.querySelector('[data-testid="matrix-group-label-input"]')),
    ).toBe(false);
    expect(shouldHandleMatrixUndoRedoShortcut(shell.querySelector("button"))).toBe(true);
    expect(shouldHandleMatrixUndoRedoShortcut(el(`<textarea class="gdg-input"></textarea>`))).toBe(
      false,
    );
  });
});
