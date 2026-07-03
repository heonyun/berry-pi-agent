// @vitest-environment jsdom
import React from "react";
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixShell, type MatrixShellProps } from "./MatrixShell.tsx";

function renderShell(overrides: Partial<MatrixShellProps> = {}) {
  const props: MatrixShellProps = {
    leftNav: <div data-testid="left-content">Left</div>,
    center: <div data-testid="center-content">Center</div>,
    detailPane: <div data-testid="right-content">Right</div>,
    leftCollapsed: false,
    rightCollapsed: false,
    onToggleLeft: vi.fn(),
    onToggleRight: vi.fn(),
    ...overrides,
  };

  render(<MatrixShell {...props} />);
  return props;
}

describe("MatrixShell hover peek", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks a collapsed left panel as peeked and exposes its content", () => {
    renderShell({ leftCollapsed: true, leftPeeked: true });

    const panel = screen.getByTestId("matrix-left-panel");
    expect(panel.getAttribute("data-collapsed")).toBe("true");
    expect(panel.getAttribute("data-peeked")).toBe("true");
    expect(screen.getByTestId("left-content").parentElement?.getAttribute("aria-hidden")).toBe(
      "false",
    );
  });

  it("ignores left peek state when the panel is persistently expanded", () => {
    renderShell({ leftCollapsed: false, leftPeeked: true });

    const panel = screen.getByTestId("matrix-left-panel");
    expect(panel.getAttribute("data-collapsed")).toBe("false");
    expect(panel.getAttribute("data-peeked")).toBe("false");
    expect(screen.getByTestId("left-content").parentElement?.getAttribute("aria-hidden")).toBe(
      "false",
    );
  });

  it("requests transient peek changes only while the left panel is collapsed", () => {
    const onLeftPeekChange = vi.fn();
    const { rerender } = render(
      <MatrixShell
        leftNav={<div>Left</div>}
        center={<div>Center</div>}
        detailPane={<div>Right</div>}
        leftCollapsed={true}
        rightCollapsed={false}
        onToggleLeft={vi.fn()}
        onToggleRight={vi.fn()}
        onLeftPeekChange={onLeftPeekChange}
      />,
    );

    fireEvent.pointerEnter(screen.getByTestId("matrix-left-panel"));
    fireEvent.pointerLeave(screen.getByTestId("matrix-left-panel"));
    expect(onLeftPeekChange).toHaveBeenNthCalledWith(1, true);
    expect(onLeftPeekChange).toHaveBeenNthCalledWith(2, false);

    onLeftPeekChange.mockClear();
    rerender(
      <MatrixShell
        leftNav={<div>Left</div>}
        center={<div>Center</div>}
        detailPane={<div>Right</div>}
        leftCollapsed={false}
        rightCollapsed={false}
        onToggleLeft={vi.fn()}
        onToggleRight={vi.fn()}
        onLeftPeekChange={onLeftPeekChange}
      />,
    );

    fireEvent.pointerEnter(screen.getByTestId("matrix-left-panel"));
    expect(onLeftPeekChange).not.toHaveBeenCalled();
  });

  it("keeps the persistent toggle action available while peeked", () => {
    const onToggleLeft = vi.fn();
    renderShell({ leftCollapsed: true, leftPeeked: true, onToggleLeft });

    fireEvent.click(screen.getByRole("button", { name: "Show groups/history panel" }));

    expect(onToggleLeft).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("matrix-left-panel").getAttribute("data-collapsed")).toBe("true");
  });

  it("keeps touch pointers on the explicit toggle path", () => {
    const onLeftPeekChange = vi.fn();
    renderShell({ leftCollapsed: true, onLeftPeekChange });

    const touchEvent = createEvent.pointerEnter(screen.getByTestId("matrix-left-panel"));
    Object.defineProperty(touchEvent, "pointerType", { value: "touch" });
    fireEvent(screen.getByTestId("matrix-left-panel"), touchEvent);

    expect(onLeftPeekChange).not.toHaveBeenCalled();
  });

  it("supports right panel hover peek symmetrically", () => {
    const onRightPeekChange = vi.fn();
    renderShell({ rightCollapsed: true, rightPeeked: true, onRightPeekChange });

    const panel = screen.getByTestId("matrix-right-panel");
    expect(panel.getAttribute("data-collapsed")).toBe("true");
    expect(panel.getAttribute("data-peeked")).toBe("true");
    expect(screen.getByTestId("right-content").parentElement?.getAttribute("aria-hidden")).toBe(
      "false",
    );

    fireEvent.pointerEnter(panel);
    expect(onRightPeekChange).toHaveBeenCalledWith(true);
    fireEvent.pointerLeave(panel);
    expect(onRightPeekChange).toHaveBeenCalledWith(false);
  });
});
