/** IME helpers for Matrix grid edit-on-type (Glide seeds event.key before composition). */
// RELATED: issue-93, matrix-ime.test.ts

export interface MatrixImeKeyProbe {
  readonly key: string;
  readonly keyCode: number;
  readonly isComposing?: boolean;
}

/**
 * CONTRACT: returns true when Glide editOnType must not seed event.key into the overlay.
 * WHY: Korean IME on Windows fires keydown with Latin physical key before compositionstart.
 */
export function shouldCancelMatrixEditOnTypeForIme(probe: MatrixImeKeyProbe): boolean {
  if (probe.isComposing === true) {
    return true;
  }
  // ASSUMPTION: keyCode 229 and key "Process" cover Windows IME; macOS may differ.
  if (probe.keyCode === 229) {
    return true;
  }
  if (probe.key === "Process") {
    return true;
  }
  return false;
}

/** True when a lone Latin letter is likely an IME physical-key seed, not intentional ASCII input. */
export function isLikelyImeLatinSeed(value: string): boolean {
  return value.length === 1 && /^[a-z]$/i.test(value);
}
