/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImeTextarea } from "./ImeTextarea.tsx";

afterEach(() => {
  cleanup();
});

describe("ImeTextarea", () => {
  it("does not commit parent updates while IME composition is active", () => {
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
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("안녕");
  });

  it("commits latin input immediately when not composing", () => {
    const onValueChange = vi.fn();

    render(<ImeTextarea value="" onValueChange={onValueChange} aria-label="prompt" />);

    const textarea = screen.getByLabelText("prompt");
    fireEvent.change(textarea, { target: { value: "hello" } });

    expect(onValueChange).toHaveBeenCalledWith("hello");
  });
});
