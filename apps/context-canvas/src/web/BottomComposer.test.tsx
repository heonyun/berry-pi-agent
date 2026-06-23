/** @vitest-environment jsdom */

import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomComposer, type BottomComposerHandle } from "./BottomComposer.tsx";

afterEach(() => {
  cleanup();
});

describe("BottomComposer", () => {
  it("enables Run while typing and submits on Ctrl+Enter from the live draft", () => {
    const onSubmit = vi.fn();

    render(<BottomComposer onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Ask a question… (Ctrl+Enter to send)");
    const runButton = screen.getByRole("button", { name: "Run" });

    expect(runButton).toHaveProperty("disabled", true);

    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(runButton).toHaveProperty("disabled", false);

    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(runButton).toHaveProperty("disabled", true);
  });

  it("submits trimmed text when Run is clicked", () => {
    const onSubmit = vi.fn();

    render(<BottomComposer onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Ask a question… (Ctrl+Enter to send)");
    fireEvent.change(textarea, { target: { value: "  stack gap  " } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(onSubmit).toHaveBeenCalledWith("stack gap");
  });

  it("exposes focus through ref when enabled", () => {
    const ref = createRef<BottomComposerHandle>();
    render(<BottomComposer ref={ref} onSubmit={vi.fn()} />);

    const textarea = screen.getByPlaceholderText("Ask a question… (Ctrl+Enter to send)");
    textarea.blur();
    expect(document.activeElement).not.toBe(textarea);

    ref.current?.focus();
    expect(document.activeElement).toBe(textarea);
  });

  it("does not focus while disabled", () => {
    const ref = createRef<BottomComposerHandle>();
    render(<BottomComposer ref={ref} disabled onSubmit={vi.fn()} />);

    const textarea = screen.getByPlaceholderText("Ask a question… (Ctrl+Enter to send)");
    textarea.blur();
    ref.current?.focus();
    expect(document.activeElement).not.toBe(textarea);
  });
});
