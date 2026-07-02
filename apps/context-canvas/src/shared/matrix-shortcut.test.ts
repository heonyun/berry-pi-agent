import { describe, expect, it } from "vitest";
import {
  matrixShortcutBlockedStatus,
  matrixShortcutDirection,
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

  it("returns null outside matrix shell", () => {
    expect(matrixShortcutBlockedStatus(document.body)).toBeNull();
  });
});
