import {
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";

export interface ImeTextareaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "onChange" | "defaultValue"
  > {
  /** Optional passthrough for native change events. */
  onChange?: TextareaHTMLAttributes<HTMLTextAreaElement>["onChange"];
  value: string;
  /** Clears this exact starter value on focus without committing immediately. */
  clearOnFocusValue?: string;
  /** Hides this edit-on-type seed for one task so native IME composition can claim the input. */
  deferOnFocusValue?: string;
  /** Fires on every edit, including during IME composition (for reading latest draft). */
  onLocalChange?: (value: string) => void;
  /** Fires when a committed value should sync to persistent state. */
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void;
}

/**
 * Draft-controlled textarea that defers parent commits until editing is done.
 * See: https://github.com/langflow-ai/langflow/issues/12376
 */
export const ImeTextarea = memo(forwardRef<HTMLTextAreaElement, ImeTextareaProps>(function ImeTextarea({
  value,
  clearOnFocusValue,
  deferOnFocusValue,
  onLocalChange,
  onValueChange,
  onCommit,
  onBlur,
  onFocus,
  onCompositionStart,
  onCompositionEnd,
  onChange: onChangeProp,
  ...rest
}: ImeTextareaProps, forwardedRef) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  const draftRef = useRef(value);
  const focusedRef = useRef(false);
  const blurDuringCompositionRef = useRef(false);
  const deferredSeedTimerRef = useRef<number | null>(null);
  const deferredSeedValueRef = useRef(deferOnFocusValue);

  useEffect(() => {
    deferredSeedValueRef.current = deferOnFocusValue;
  }, [deferOnFocusValue]);

  useEffect(() => {
    return () => {
      if (deferredSeedTimerRef.current !== null) {
        window.clearTimeout(deferredSeedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!composingRef.current) {
      setDraft(value);
      draftRef.current = value;
    }
  }, [value]);

  const commit = useCallback(
    (next: string) => {
      onCommit?.(next);
      onValueChange(next);
    },
    [onCommit, onValueChange],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChangeProp?.(event);
      let next = event.target.value;
      if (deferredSeedTimerRef.current !== null && !composingRef.current) {
        window.clearTimeout(deferredSeedTimerRef.current);
        deferredSeedTimerRef.current = null;
        const seed = deferredSeedValueRef.current;
        if (seed !== undefined && !next.startsWith(seed)) {
          // CONTRACT: rapid ASCII typing can deliver the second character before
          // the deferred seed task. Merge it instead of letting the timer erase it.
          next = `${seed}${next}`;
        }
      }
      setDraft(next);
      draftRef.current = next;
      onLocalChange?.(next);
    },
    [onChangeProp, onLocalChange],
  );

  const handleCompositionStart = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = true;
      if (deferredSeedTimerRef.current !== null) {
        window.clearTimeout(deferredSeedTimerRef.current);
        deferredSeedTimerRef.current = null;
      }
      focusedRef.current = true;
      blurDuringCompositionRef.current = false;
      onCompositionStart?.(event);
    },
    [onCompositionStart],
  );

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      onCompositionEnd?.(event);
      const next = event.currentTarget.value;
      setDraft(next);
      draftRef.current = next;
      onLocalChange?.(next);
      if (blurDuringCompositionRef.current || !focusedRef.current) {
        blurDuringCompositionRef.current = false;
        commit(next);
      }
    },
    [commit, onCompositionEnd, onLocalChange],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      onBlur?.(event);
      focusedRef.current = false;
      if (deferredSeedTimerRef.current !== null) {
        window.clearTimeout(deferredSeedTimerRef.current);
        deferredSeedTimerRef.current = null;
        const seed = deferredSeedValueRef.current;
        if (!composingRef.current && seed !== undefined) {
          setDraft(seed);
          draftRef.current = seed;
        }
      }
      if (composingRef.current) {
        blurDuringCompositionRef.current = true;
        return;
      }
      commit(draftRef.current);
    },
    [commit, onBlur],
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      onFocus?.(event);
      focusedRef.current = true;
      if (deferredSeedTimerRef.current !== null) {
        window.clearTimeout(deferredSeedTimerRef.current);
        deferredSeedTimerRef.current = null;
      }
      if (deferOnFocusValue !== undefined && draftRef.current === deferOnFocusValue) {
        // INVARIANT: focus is the last application-owned boundary before native
        // compositionstart. Hide Glide's physical-key seed here, then restore it
        // only after the browser has had a task to start IME composition (#143).
        event.currentTarget.value = "";
        setDraft("");
        draftRef.current = "";
        deferredSeedTimerRef.current = window.setTimeout(() => {
          deferredSeedTimerRef.current = null;
          if (composingRef.current || !focusedRef.current) {
            return;
          }
          const seed = deferredSeedValueRef.current;
          if (seed === undefined) {
            return;
          }
          setDraft(seed);
          draftRef.current = seed;
        }, 0);
        return;
      }
      if (clearOnFocusValue === undefined || draftRef.current !== clearOnFocusValue) {
        return;
      }
      setDraft("");
      draftRef.current = "";
      onLocalChange?.("");
    },
    [clearOnFocusValue, deferOnFocusValue, onFocus, onLocalChange],
  );

  return (
    <textarea
      {...rest}
      ref={forwardedRef}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  );
}));

export function stopNodeKeyPropagation(event: KeyboardEvent<HTMLElement>): void {
  event.stopPropagation();
}
