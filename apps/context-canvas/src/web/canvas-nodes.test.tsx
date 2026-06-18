/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptInputNode } from "./canvas-nodes.tsx";
import type { PromptNodeData } from "../adapters/react-flow.ts";

afterEach(() => {
  cleanup();
});

describe("PromptInputNode", () => {
  it("runs the prompt on Ctrl+Enter after updating the latest draft", () => {
    const onDraftChange = vi.fn();
    const onTextChange = vi.fn();
    const onRun = vi.fn();
    const data: PromptNodeData = {
      nodeId: "prompt-1",
      text: "",
      stance: "neutral",
      running: false,
      interactionDisabled: false,
      deleteArmed: false,
      isNew: false,
      onDraftChange,
      onTextChange,
      onRun,
      onArmDelete: vi.fn(),
      onDelete: vi.fn(),
    };

    render(
      <ReactFlowProvider>
        <PromptInputNode
          id="prompt-1"
          type="promptInput"
          selected={false}
          dragging={false}
          draggable
          selectable
          deletable
          zIndex={0}
          isConnectable
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          data={data}
        />
      </ReactFlowProvider>,
    );

    const textarea = screen.getByPlaceholderText("Ask the agent...");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    expect(onDraftChange).toHaveBeenLastCalledWith("prompt-1", "hello");
    expect(onTextChange).toHaveBeenCalledWith("prompt-1", "hello");
    expect(onRun).toHaveBeenCalledWith("prompt-1", "hello");
  });
});
