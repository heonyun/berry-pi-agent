import {
  memo,
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
export const ImeTextarea = memo(function ImeTextarea({
  value,
  onLocalChange,
  onValueChange,
  onCommit,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  onChange: onChangeProp,
  ...rest
}: ImeTextareaProps) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  const draftRef = useRef(value);

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
      const next = event.target.value;
      setDraft(next);
      draftRef.current = next;
      onLocalChange?.(next);
    },
    [onChangeProp, onLocalChange],
  );

  const handleCompositionStart = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = true;
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
    },
    [onCompositionEnd, onLocalChange],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      onBlur?.(event);
      if (!composingRef.current) {
        commit(draftRef.current);
      }
    },
    [commit, onBlur],
  );

  return (
    <textarea
      {...rest}
      value={draft}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  );
});

export function stopNodeKeyPropagation(event: KeyboardEvent<HTMLElement>): void {
  event.stopPropagation();
}
