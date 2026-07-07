import { describe, expect, it } from "vitest";
import {
  hasMatrixEditOnTypeImeSeed,
  shouldCancelMatrixEditOnTypeForIme,
  shouldClearMatrixEditOnTypeImeSeed,
  isLikelyImeLatinSeed,
} from "./matrix-ime.ts";

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

  it("flags a lone Latin letter as a likely IME seed", () => {
    expect(isLikelyImeLatinSeed("d")).toBe(true);
    expect(isLikelyImeLatinSeed("hello")).toBe(false);
  });
});

describe("hasMatrixEditOnTypeImeSeed", () => {
  it("detects Glide edit-on-type seed intent without depending on current cell text", () => {
    expect(hasMatrixEditOnTypeImeSeed({ forceEditMode: true, initialValue: "a" })).toBe(true);
    expect(hasMatrixEditOnTypeImeSeed({ forceEditMode: false, initialValue: "a" })).toBe(false);
    expect(hasMatrixEditOnTypeImeSeed({ forceEditMode: true })).toBe(false);
  });
});

// RELATED: issue-133 — verifies the helper separates Glide seeds from existing cell text.
describe("shouldClearMatrixEditOnTypeImeSeed", () => {
  it("clears only the matching Glide edit-on-type Latin seed", () => {
    expect(
      shouldClearMatrixEditOnTypeImeSeed({
        forceEditMode: true,
        initialValue: "a",
        currentValue: "a",
      }),
    ).toBe(true);
  });

  it("keeps intentional single-letter cell content without an edit-on-type seed", () => {
    expect(
      shouldClearMatrixEditOnTypeImeSeed({
        forceEditMode: false,
        currentValue: "a",
      }),
    ).toBe(false);
  });

  it("keeps text when Glide did not provide an initial edit-on-type seed", () => {
    expect(
      shouldClearMatrixEditOnTypeImeSeed({
        forceEditMode: true,
        currentValue: "a",
      }),
    ).toBe(false);
  });

  it("keeps text when the current editor value no longer matches the seed", () => {
    expect(
      shouldClearMatrixEditOnTypeImeSeed({
        forceEditMode: true,
        initialValue: "a",
        currentValue: "ab",
      }),
    ).toBe(false);
  });
});
