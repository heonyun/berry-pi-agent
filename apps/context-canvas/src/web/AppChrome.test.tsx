// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";

function mountStyles() {
  const style = document.createElement("style");
  style.textContent = fs.readFileSync(path.resolve(__dirname, "styles.css"), "utf8");
  document.head.append(style);
  return style;
}

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  Controls: () => null,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    fitView: vi.fn(),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  ReactFlow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-view">{children}</div>
  ),
}));

vi.mock("./MatrixCanvas.tsx", () => ({
  MatrixCanvas: () => <main data-testid="matrix-view">Matrix view</main>,
}));

afterEach(() => {
  cleanup();
  document.head.querySelectorAll("style").forEach((style) => style.remove());
});

describe("App chrome", () => {
  it("keeps the view toggle in a stable app chrome across Matrix and Canvas views", () => {
    render(<App />);

    const chrome = screen.getByTestId("app-chrome");
    const toggle = screen.getByTestId("view-toggle");
    expect(chrome.contains(toggle)).toBe(true);
    expect(screen.getByRole("button", { name: "Canvas" })).toBe(toggle);
    expect(screen.getByTestId("matrix-view")).toBeTruthy();

    fireEvent.click(toggle);

    expect(screen.getByTestId("app-chrome").contains(screen.getByTestId("view-toggle"))).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Matrix" })).toBe(screen.getByTestId("view-toggle"));
    expect(screen.getByTestId("canvas-view")).toBeTruthy();
  });

  it("does not render the view toggle as a fixed top-left overlay", () => {
    mountStyles();
    render(<App />);

    const style = window.getComputedStyle(screen.getByTestId("view-toggle"));
    expect(style.position).not.toBe("fixed");
    expect(style.zIndex).not.toBe("1000");
    expect(style.top).not.toBe("8px");
    expect(style.left).not.toBe("8px");
  });
});
