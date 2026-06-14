/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
