/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImeTextarea } from "./ImeTextarea.tsx";

afterEach(() => {
  cleanup();
});

describe("ImeTextarea", () => {
  it("does not commit parent updates until blur after IME composition", () => {
    const onValueChange = vi.fn();

    render(
      <ImeTextarea value="" onValueChange={onValueChange} aria-label="prompt" />,
    );

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "안ㄴ" } });
    fireEvent.change(textarea, { target: { value: "안ㄴㅕ" } });

    expect(textarea.value).toBe("안ㄴㅕ");
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(textarea, { data: "안녕", target: { value: "안녕" } });

    expect(textarea.value).toBe("안녕");
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.blur(textarea);

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("안녕");
  });

  it("keeps latin input local until blur", () => {
    const onValueChange = vi.fn();

    render(<ImeTextarea value="" onValueChange={onValueChange} aria-label="prompt" />);

    const textarea = screen.getByLabelText("prompt");
    fireEvent.change(textarea, { target: { value: "hello" } });

    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.blur(textarea);

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("hello");
  });

  it("defers a starter seed until the next task when composition does not start", () => {
    vi.useFakeTimers();
    render(
      <ImeTextarea
        value="a"
        deferOnFocusValue="a"
        onValueChange={vi.fn()}
        aria-label="prompt"
      />,
    );

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.focus(textarea);

    expect(textarea.value).toBe("");
    act(() => vi.runOnlyPendingTimers());
    expect(textarea.value).toBe("a");
    vi.useRealTimers();
  });

  it("preserves a deferred ASCII seed when more text arrives before the next task", () => {
    vi.useFakeTimers();
    render(
      <ImeTextarea
        value="w"
        deferOnFocusValue="w"
        onValueChange={vi.fn()}
        aria-label="prompt"
      />,
    );

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "o" } });
    fireEvent.change(textarea, { target: { value: "wor" } });
    fireEvent.change(textarea, { target: { value: "world" } });
    act(() => vi.runOnlyPendingTimers());

    expect(textarea.value).toBe("world");
    vi.useRealTimers();
  });

  it("cancels a deferred starter seed without mutating the DOM during compositionstart", () => {
    vi.useFakeTimers();
    const onLocalChange = vi.fn();
    render(
      <ImeTextarea
        value="a"
        deferOnFocusValue="a"
        onLocalChange={onLocalChange}
        onValueChange={vi.fn()}
        aria-label="prompt"
      />,
    );

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.compositionStart(textarea);
    act(() => vi.runOnlyPendingTimers());

    expect(textarea.value).toBe("");
    expect(onLocalChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("commits the ASCII seed when blur wins the deferred-seed race", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(
      <ImeTextarea
        value="a"
        deferOnFocusValue="a"
        onValueChange={onValueChange}
        aria-label="prompt"
      />,
    );

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.blur(textarea);
    act(() => vi.runOnlyPendingTimers());

    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith("a");
    vi.useRealTimers();
  });

  it("commits once if blur happens while IME composition is active", () => {
    const onValueChange = vi.fn();

    render(<ImeTextarea value="" onValueChange={onValueChange} aria-label="prompt" />);

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "안ㄴ" } });

    fireEvent.blur(textarea);

    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(textarea, { data: "안녕", target: { value: "안녕" } });

    expect(textarea.value).toBe("안녕");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("안녕");
  });

  // RELATED: issue-143 — compositionstart must not import workaround DOM mutations.
  it("does not import compositionstart DOM mutations into the controlled draft", () => {
    const onValueChange = vi.fn();
    function StatefulTextarea() {
      const [value] = useState("a");
      return (
        <ImeTextarea
          value={value}
          onValueChange={onValueChange}
          onCompositionStart={(event) => {
            event.currentTarget.value = "";
          }}
          aria-label="prompt"
        />
      );
    }

    render(<StatefulTextarea />);

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.compositionStart(textarea);
    fireEvent.blur(textarea);

    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(textarea, { target: { value: "안" } });
    expect(onValueChange).toHaveBeenCalledWith("안");
  });

  it("clears the configured starter text on focus without committing immediately", () => {
    const onLocalChange = vi.fn();
    const onValueChange = vi.fn();

    render(
      <ImeTextarea
        value="starter prompt"
        clearOnFocusValue="starter prompt"
        onLocalChange={onLocalChange}
        onValueChange={onValueChange}
        aria-label="prompt"
      />,
    );

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.focus(textarea);

    expect(textarea.value).toBe("");
    expect(onLocalChange).toHaveBeenCalledWith("");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not clear user-authored text on focus", () => {
    const onLocalChange = vi.fn();
    const onValueChange = vi.fn();

    render(
      <ImeTextarea
        value="user prompt"
        clearOnFocusValue="starter prompt"
        onLocalChange={onLocalChange}
        onValueChange={onValueChange}
        aria-label="prompt"
      />,
    );

    const textarea = screen.getByLabelText("prompt") as HTMLTextAreaElement;
    fireEvent.focus(textarea);

    expect(textarea.value).toBe("user prompt");
    expect(onLocalChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("forwards data attributes to the underlying textarea", () => {
    render(
      <ImeTextarea
        value="prompt"
        onValueChange={vi.fn()}
        aria-label="prompt"
        data-prompt-id="prompt-123"
      />,
    );

    expect(screen.getByLabelText("prompt").getAttribute("data-prompt-id")).toBe("prompt-123");
  });

  it("forwards refs to the underlying textarea", () => {
    const ref = createRef<HTMLTextAreaElement>();

    render(<ImeTextarea ref={ref} value="prompt" onValueChange={vi.fn()} aria-label="prompt" />);

    expect(ref.current).toBe(screen.getByLabelText("prompt"));
  });
});
