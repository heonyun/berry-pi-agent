/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialDocument } from "../shared/domain.ts";
import { App } from "./App.tsx";

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    fitView: vi.fn(),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  ReactFlow: ({
    nodes,
    children,
  }: {
    nodes: Array<{ id: string; data: { text?: string; onRun?: (nodeId: string, text?: string) => void } }>;
    children: React.ReactNode;
  }) => (
    <div>
      {nodes.map((node) => (
        <div key={node.id} data-testid="flow-node">
          {node.data.text}
          {node.data.onRun ? (
            <button type="button" onClick={() => node.data.onRun?.(node.id, node.data.text)}>
              Run {node.id}
            </button>
          ) : null}
        </div>
      ))}
      {children}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App bundle hydration", () => {
  it("renders the saved bundle instead of always starting from a new canvas", async () => {
    const savedDocument = {
      ...createInitialDocument(),
      nodes: [
        {
          ...createInitialDocument().nodes[0]!,
          text: "persisted prompt after reload",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toBe("/api/bundle/load");
        return new Response(JSON.stringify({ document: savedDocument, warnings: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("persisted prompt after reload")).toBeTruthy();
    });
    expect(screen.queryByText("What should we explore on this canvas?")).toBeNull();
  });

  it("does not run or save before bundle loading has completed", async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toBe("/api/bundle/load");
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByText("Run prompt-1"));

    expect(await screen.findByText("Waiting for saved bundle to load...")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps run blocked with the load failure reason after a non-404 load error", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("/api/bundle/load");
      return new Response(JSON.stringify({ errors: ["corrupt bundle"] }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    expect(await screen.findByText("Bundle load failed: corrupt bundle")).toBeTruthy();

    fireEvent.click(screen.getByText("Run prompt-1"));

    expect(await screen.findByText("Bundle load failed: corrupt bundle")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
