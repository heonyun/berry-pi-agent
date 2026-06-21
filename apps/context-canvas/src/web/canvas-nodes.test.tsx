/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIAnswerNode, PromptInputNode } from "./canvas-nodes.tsx";
import type { AnswerNodeData, PromptNodeData } from "../adapters/react-flow.ts";

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

describe("AIAnswerNode", () => {
  it("places an armed delete control immediately right of the positive action and deletes when clicked", () => {
    const onDelete = vi.fn();
    const data: AnswerNodeData = {
      nodeId: "answer-1",
      text: "Answer text",
      stance: "neutral",
      versionCount: 1,
      running: false,
      interactionDisabled: false,
      deleteArmed: true,
      isNew: false,
      selected: true,
      multiSelected: false,
      onFeedback: vi.fn(),
      onArmDelete: vi.fn(),
      onDelete,
      onRetry: vi.fn(),
      onAnswerAction: vi.fn(),
    };

    render(
      <ReactFlowProvider>
        <AIAnswerNode
          id="answer-1"
          type="aiAnswer"
          selected
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

    const deleteButton = screen.getByLabelText("Delete node");
    expect(deleteButton.classList.contains("answer-delete-node-button")).toBe(true);
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith("answer-1");
  });

  it("renders enabled corner action handles for non-empty selected answers", () => {
    const onAnswerAction = vi.fn();
    const data: AnswerNodeData = {
      nodeId: "answer-1",
      text: "Answer text",
      stance: "neutral",
      versionCount: 1,
      running: false,
      interactionDisabled: false,
      deleteArmed: false,
      isNew: false,
      selected: true,
      multiSelected: false,
      onFeedback: vi.fn(),
      onArmDelete: vi.fn(),
      onDelete: vi.fn(),
      onRetry: vi.fn(),
      onAnswerAction,
    };

    render(
      <ReactFlowProvider>
        <AIAnswerNode
          id="answer-1"
          type="aiAnswer"
          selected
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

    fireEvent.pointerDown(screen.getByLabelText("Ask for answer risks"));
    fireEvent.pointerUp(screen.getByLabelText("Ask for answer risks"));

    expect(onAnswerAction).toHaveBeenCalledWith("answer-1", "risks");
  });

  it("disables corner action handles for multi-selected answers", () => {
    const onAnswerAction = vi.fn();
    const data: AnswerNodeData = {
      nodeId: "answer-1",
      text: "Answer text",
      stance: "neutral",
      versionCount: 1,
      running: false,
      interactionDisabled: false,
      deleteArmed: false,
      isNew: false,
      selected: true,
      multiSelected: true,
      onFeedback: vi.fn(),
      onArmDelete: vi.fn(),
      onDelete: vi.fn(),
      onRetry: vi.fn(),
      onAnswerAction,
    };

    render(
      <ReactFlowProvider>
        <AIAnswerNode
          id="answer-1"
          type="aiAnswer"
          selected
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

    expect(screen.getByLabelText("Ask for answer risks")).toHaveProperty("disabled", true);
  });
});
