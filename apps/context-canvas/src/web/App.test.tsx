/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialDocument, type ContextCanvasDocument } from "../shared/domain.ts";
import { LegacyApp as App } from "./LegacyApp.tsx";

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
    onNodeClick,
    onPaneClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    panOnDrag,
  }: {
    nodes: Array<{
      id: string;
      type?: string;
      data: {
        text?: string;
        interactionDisabled?: boolean;
        deleteArmed?: boolean;
        onRun?: (nodeId: string, text?: string) => void;
        onTextChange?: (nodeId: string, text: string) => void;
      };
    }>;
    children: React.ReactNode;
    onNodeClick?: (event: React.MouseEvent, node: { id: string }) => void;
    onPaneClick?: (event: React.MouseEvent) => void;
    onPointerDown?: (event: React.PointerEvent) => void;
    onPointerMove?: (event: React.PointerEvent) => void;
    onPointerUp?: (event: React.PointerEvent) => void;
    onPointerCancel?: (event: React.PointerEvent) => void;
    panOnDrag?: boolean | number[];
  }) => (
    <div
      data-testid="flow-pane"
      data-pan-on-drag={JSON.stringify(panOnDrag)}
      onClick={(event) => onPaneClick?.(event)}
      onPointerDown={(event) => onPointerDown?.(event)}
      onPointerMove={(event) => onPointerMove?.(event)}
      onPointerUp={(event) => onPointerUp?.(event)}
      onPointerCancel={(event) => onPointerCancel?.(event)}
    >
      {nodes.map((node) => (
        <div
          key={node.id}
          data-testid="flow-node"
          data-node-id={node.id}
          data-delete-armed={node.data.deleteArmed ? "true" : "false"}
        >
          {node.data.text}
          {node.data.onTextChange ? (
            <input aria-label={`mock text ${node.id}`} value={node.data.text ?? ""} readOnly />
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNodeClick?.(event, { id: node.id });
            }}
          >
            Select {node.id}
          </button>
          {node.data.interactionDisabled ? <span>disabled {node.id}</span> : null}
          {node.data.onRun ? (
            <button type="button" onClick={() => node.data.onRun?.(node.id, node.data.text)}>
              Run {node.id}
            </button>
          ) : null}
          {node.data.onTextChange ? (
            <button type="button" onClick={() => node.data.onTextChange?.(node.id, "edited before load")}>
              Edit {node.id}
            </button>
          ) : null}
        </div>
      ))}
      <div data-testid="contenteditable-false" contentEditable="false" />
      {children}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App bundle hydration", () => {
  function documentWithAnswer(): ContextCanvasDocument {
    return {
      ...createInitialDocument(),
      nodes: [
        {
          id: "prompt-1",
          kind: "prompt_input",
          groupId: "group-1",
          text: "Question",
          position: { x: 0, y: 0 },
          metadata: { stance: "neutral" },
        },
        {
          id: "answer-1",
          kind: "ai_answer",
          groupId: "group-1",
          text: "Answer text",
          position: { x: 0, y: 220 },
          metadata: { stance: "neutral" },
        },
        {
          id: "prompt-2",
          kind: "prompt_input",
          groupId: "group-1",
          text: "Second question",
          position: { x: 140, y: 0 },
          metadata: { stance: "neutral" },
        },
      ],
      edges: [{ id: "edge-1", source: "prompt-1", target: "answer-1", meaning: "lineage" }],
    };
  }

  function streamResponse(text = "streamed answer") {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "text_delta", delta: text })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }

  function documentWithEmptyAnswer(): ContextCanvasDocument {
    const document = documentWithAnswer();
    const answer = document.nodes.find((node) => node.id === "answer-1");
    if (answer) {
      answer.text = "   ";
    }
    return document;
  }

  async function dragSelectNodes() {
    const pane = await screen.findByTestId("flow-pane");
    fireEvent(pane, panePointerEvent("pointerdown", { button: 0, buttons: 1, pointerId: 1, clientX: 0, clientY: 0 }));
    fireEvent(pane, panePointerEvent("pointermove", { button: 0, buttons: 1, pointerId: 1, clientX: 250, clientY: 300 }));
    fireEvent(pane, panePointerEvent("pointerup", { button: 0, pointerId: 1, clientX: 250, clientY: 300 }));
    expect(await screen.findByText("Create group")).toBeTruthy();
    return pane;
  }

  function panePointerEvent(type: string, init: { button?: number; buttons?: number; pointerId?: number; clientX: number; clientY: number }) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      button: { value: init.button ?? 0 },
      buttons: { value: init.buttons ?? 0 },
      pointerId: { value: init.pointerId ?? 1 },
      clientX: { value: init.clientX },
      clientY: { value: init.clientY },
      pageX: { value: init.clientX },
      pageY: { value: init.clientY },
    });
    return event;
  }

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

    const { container } = render(<App />);
    fireEvent.click(screen.getByText("Run prompt-1"));

    expect(await screen.findByText("Waiting for saved bundle to load...")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not mutate the starter document before bundle loading has completed", async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toBe("/api/bundle/load");
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    expect(screen.getByText("disabled prompt-1")).toBeTruthy();
    fireEvent.click(screen.getByText("Edit prompt-1"));

    expect(screen.queryByText("edited before load")).toBeNull();
    expect(await screen.findByText("Waiting for saved bundle to load...")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enables the starter canvas after a first-run 404 bundle load", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ errors: ["missing"] }), { status: 404 });
      }
      if (url === "/api/prompt") {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        );
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("No saved bundle found.")).toBeTruthy();
    expect(screen.queryByText("disabled prompt-1")).toBeNull();

    fireEvent.click(screen.getByText("Run prompt-1"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prompt",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
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

  it("keeps drag-selected nodes and the group confirmation after the pane click that follows drag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/bundle/load") {
          return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
        }
        if (url === "/api/bundle/export") {
          return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<App />);
    const pane = await screen.findByTestId("flow-pane");

    expect(pane.getAttribute("data-pan-on-drag")).toBe("[1]");

    fireEvent(pane, panePointerEvent("pointerdown", { button: 0, buttons: 1, pointerId: 1, clientX: 0, clientY: 0 }));
    fireEvent(pane, panePointerEvent("pointermove", { button: 0, buttons: 1, pointerId: 1, clientX: 250, clientY: 300 }));
    fireEvent(pane, panePointerEvent("pointerup", { button: 0, pointerId: 1, clientX: 250, clientY: 300 }));
    expect(await screen.findByText("Create group")).toBeTruthy();

    fireEvent.click(pane);
    expect(screen.getByText("Create group")).toBeTruthy();

    fireEvent.click(screen.getByText("Select answer-1"));
    expect(screen.queryByText("Create group")).toBeNull();
  });

  it("clears selection overlay when pointer selection is cancelled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/bundle/load") {
          return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<App />);
    const pane = await screen.findByTestId("flow-pane");

    fireEvent(pane, panePointerEvent("pointerdown", { button: 0, buttons: 1, pointerId: 1, clientX: 0, clientY: 0 }));
    fireEvent(pane, panePointerEvent("pointermove", { button: 0, buttons: 1, pointerId: 1, clientX: 100, clientY: 100 }));
    await waitFor(() => {
      expect(container.querySelector(".selection-overlay")).not.toBeNull();
    });

    fireEvent(pane, panePointerEvent("pointercancel", { pointerId: 1, clientX: 100, clientY: 100 }));
    expect(container.querySelector(".selection-overlay")).toBeNull();
  });

  it("runs answer actions through ordered Ctrl+arrow shortcut sequences", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      if (url === "/api/prompt") {
        return streamResponse("retried");
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    await screen.findByText("Select answer-1");
    fireEvent.click(screen.getByText("Select answer-1"));

    fireEvent.keyDown(shell, { key: "ArrowLeft", ctrlKey: true });
    fireEvent.keyDown(shell, { key: "ArrowUp", ctrlKey: true });
    expect(await screen.findByText("좋아. 너의 답에서 예상 문제와 위험을 말해.")).toBeTruthy();

    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "ArrowRight", ctrlKey: true });
    fireEvent.keyDown(shell, { key: "ArrowUp", ctrlKey: true });
    expect(await screen.findByText("좋아. 너의 답에서 예상 긍정을 말해.")).toBeTruthy();

    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "ArrowLeft", ctrlKey: true });
    fireEvent.keyDown(shell, { key: "ArrowDown", ctrlKey: true });
    expect(await screen.findByText("다시 너의 답에 문제와 위험을 생각해서 답해.")).toBeTruthy();

    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "ArrowDown", ctrlKey: true });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/prompt", expect.objectContaining({ method: "POST" }));
    });
  });

  it("suppresses answer shortcuts for repeat events and text entry focus", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(screen.getByText("Select answer-1"));

    fireEvent.keyDown(shell, { key: "ArrowLeft", ctrlKey: true });
    fireEvent.keyDown(shell, { key: "ArrowUp", ctrlKey: true, repeat: true });
    expect(screen.queryByText("좋아. 너의 답에서 예상 문제와 위험을 말해.")).toBeNull();

    const textarea = screen.getByLabelText("mock text prompt-1");
    fireEvent.keyDown(textarea, { key: "ArrowLeft", ctrlKey: true });
    fireEvent.keyDown(textarea, { key: "ArrowUp", ctrlKey: true });
    expect(screen.queryByText("좋아. 너의 답에서 예상 문제와 위험을 말해.")).toBeNull();

    fireEvent.click(screen.getByText("Select answer-1"));
    const contenteditableFalse = screen.getByTestId("contenteditable-false");
    fireEvent.keyDown(contenteditableFalse, { key: "ArrowLeft", ctrlKey: true });
    fireEvent.keyDown(contenteditableFalse, { key: "ArrowUp", ctrlKey: true });
    expect(await screen.findByText("좋아. 너의 답에서 예상 문제와 위험을 말해.")).toBeTruthy();
  });

  it("arms the delete affordance for exactly one selected node when Delete is pressed", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "Delete" });

    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("true");
    expect(screen.getByText("Answer text")).toBeTruthy();
  });

  it("deletes the armed node when Delete is pressed a second time", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "Delete" });
    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("true");

    fireEvent.keyDown(shell, { key: "Delete" });
    await waitFor(() => {
      expect(document.querySelector('[data-node-id="answer-1"]')).toBeNull();
    });
    expect(screen.queryByText("Answer text")).toBeNull();
  });

  it("clears the delete arm when the same node is selected again", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "Delete" });
    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("true");

    fireEvent.click(screen.getByText("Select answer-1"));
    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("false");
  });

  it("clears the delete arm on Escape; second Delete re-arms without deleting", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "Delete" });
    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("true");

    fireEvent.keyDown(shell, { key: "Escape" });
    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("false");

    fireEvent.keyDown(shell, { key: "Delete" });
    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("true");
    expect(screen.getByText("Answer text")).toBeTruthy();
  });

  it("arms then deletes the next selected node after keyboard deletion", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "Delete" });
    fireEvent.keyDown(shell, { key: "Delete" });
    await waitFor(() => {
      expect(document.querySelector('[data-node-id="answer-1"]')).toBeNull();
    });

    fireEvent.keyDown(shell, { key: "Delete" });
    expect(document.querySelector('[data-node-id="prompt-1"]')?.getAttribute("data-delete-armed")).toBe("true");
    fireEvent.keyDown(shell, { key: "Delete" });
    await waitFor(() => {
      expect(document.querySelector('[data-node-id="prompt-1"]')).toBeNull();
    });
  });

  it("ignores repeated Delete keydown events", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(screen.getByText("Select answer-1"));
    fireEvent.keyDown(shell, { key: "Delete", repeat: true });
    expect(document.querySelector('[data-node-id="answer-1"]')?.getAttribute("data-delete-armed")).toBe("false");
    expect(screen.getByText("Answer text")).toBeTruthy();
  });

  it("does not arm deletion with no selection, from text entry, or with multi-selection", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(await screen.findByTestId("flow-pane"));
    fireEvent.keyDown(shell, { key: "Delete" });
    expect(document.querySelector('[data-delete-armed="true"]')).toBeNull();

    fireEvent.keyDown(screen.getByLabelText("mock text prompt-1"), { key: "Delete" });
    expect(document.querySelector('[data-delete-armed="true"]')).toBeNull();

    await dragSelectNodes();
    fireEvent.keyDown(shell, { key: "Delete" });
    expect(document.querySelector('[data-delete-armed="true"]')).toBeNull();
  });

  it("creates a group when Enter confirms drag selection", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await dragSelectNodes();

    fireEvent.keyDown(await screen.findByTestId("app-shell"), { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByText("Create group")).toBeNull();
    });
    expect(await screen.findByText("Group created")).toBeTruthy();
  });

  it("blocks answer shortcuts when multiple nodes are selected", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    await dragSelectNodes();

    fireEvent.keyDown(shell, { key: "ArrowLeft", ctrlKey: true });
    fireEvent.keyDown(shell, { key: "ArrowUp", ctrlKey: true });

    expect(screen.queryByText("좋아. 너의 답에서 예상 문제와 위험을 말해.")).toBeNull();
    expect(await screen.findByText("Select exactly one answer node for this action.")).toBeTruthy();
  });

  it("dismisses group confirmation when Cancel is clicked", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await dragSelectNodes();
    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText("Create group")).toBeNull();
    });
    expect(screen.queryByText("Group created")).toBeNull();
  });

  it("dismisses group confirmation when a node is clicked", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await dragSelectNodes();
    fireEvent.click(screen.getByText("Select prompt-1"));

    await waitFor(() => {
      expect(screen.queryByText("Create group")).toBeNull();
    });
    expect(screen.queryByText("Group created")).toBeNull();
  });

  it("dismisses group confirmation on Escape", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    await dragSelectNodes();

    fireEvent.keyDown(shell, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Create group")).toBeNull();
    });
    expect(screen.queryByText("Group created")).toBeNull();
  });

  it("blocks answer shortcuts for empty answers", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithEmptyAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    fireEvent.click(await screen.findByText("Select answer-1"));

    fireEvent.keyDown(shell, { key: "ArrowDown", ctrlKey: true });

    expect(await screen.findByText("Answer action is unavailable while the answer is empty or running.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/prompt", expect.anything());
  });

  it("blocks answer shortcuts while a prompt is running", async () => {
    let resolvePrompt: (() => void) | undefined;
    const promptGate = new Promise<void>((resolve) => {
      resolvePrompt = resolve;
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      if (url === "/api/prompt") {
        await promptGate;
        return streamResponse("still running");
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const shell = await screen.findByTestId("app-shell");
    try {
      fireEvent.click(await screen.findByText("Run prompt-1"));
      expect(await screen.findByText("Running agent...")).toBeTruthy();

      fireEvent.click(screen.getByText("Select answer-1"));
      fireEvent.keyDown(shell, { key: "ArrowDown", ctrlKey: true });

      expect(await screen.findByText("Answer action is unavailable while the answer is empty or running.")).toBeTruthy();
    } finally {
      resolvePrompt?.();
    }
  });

  it("saves group summary edits after a short debounce", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/bundle/load") {
        return new Response(JSON.stringify({ document: documentWithAnswer(), warnings: [] }), { status: 200 });
      }
      if (url === "/api/bundle/export") {
        return new Response(JSON.stringify({ pathsWritten: [], warnings: [], errors: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<App />);
    fireEvent.click(await screen.findByText("Select prompt-1"));
    const summary = container.querySelector(".group-summary-editor") as HTMLTextAreaElement | null;
    expect(summary).not.toBeNull();
    fireEvent.change(summary!, { target: { value: "Saved group summary" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bundle/export",
        expect.objectContaining({ method: "POST" }),
      );
    }, { timeout: 2_000 });
  });
});
