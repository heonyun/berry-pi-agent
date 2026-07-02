import { describe, expect, it } from "vitest";
import { shouldCancelMatrixEditOnTypeForIme } from "./matrix-ime.ts";

describe("shouldCancelMatrixEditOnTypeForIme", () => {
  it("cancels when isComposing is true", () => {
    expect(
      shouldCancelMatrixEditOnTypeForIme({
        key: "h",
        keyCode: 72,
        isComposing: true,
      }),
    ).toBe(true);
  });

  it("cancels for Windows IME keyCode 229", () => {
    expect(
      shouldCancelMatrixEditOnTypeForIme({
        key: "Process",
        keyCode: 229,
      }),
    ).toBe(true);
  });

  it("allows normal ASCII typing when not composing", () => {
    expect(
      shouldCancelMatrixEditOnTypeForIme({
        key: "a",
        keyCode: 65,
        isComposing: false,
      }),
    ).toBe(false);
  });
});
