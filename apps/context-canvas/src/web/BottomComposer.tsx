import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ImeTextarea, stopNodeKeyPropagation } from "./ImeTextarea.tsx";

export interface BottomComposerHandle {
  focus: () => void;
}

export interface BottomComposerProps {
  disabled?: boolean;
  onSubmit: (question: string) => void;
}

/** WHY: main question path is bottom-fixed; blocks stack upward from here (issue-39). */
export const BottomComposer = forwardRef<BottomComposerHandle, BottomComposerProps>(
  function BottomComposer({ disabled = false, onSubmit }, ref) {
    const [draft, setDraft] = useState("");
    const footerRef = useRef<HTMLElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          footerRef.current?.querySelector<HTMLTextAreaElement>(".bottom-composer-input")?.focus();
        },
      }),
      [],
    );

    return (
      <footer ref={footerRef} className="bottom-composer" aria-label="Canvas question input">
        <ImeTextarea
          className="bottom-composer-input nodrag nopan"
          value={draft}
          disabled={disabled}
          placeholder="Ask a question… (Ctrl+Enter to send)"
          onLocalChange={setDraft}
          onValueChange={setDraft}
          onKeyDown={(event) => {
            stopNodeKeyPropagation(event);
            const sendShortcut =
              event.key === "Enter" &&
              (event.ctrlKey || event.metaKey) &&
              !event.nativeEvent.isComposing;
            if (sendShortcut) {
              event.preventDefault();
              const text = event.currentTarget.value.trim();
              if (text) {
                onSubmit(text);
                setDraft("");
              }
            }
          }}
        />
        <button
          type="button"
          className="bottom-composer-run nodrag nopan"
          disabled={disabled || draft.trim().length === 0}
          onClick={() => {
            const text = draft.trim();
            if (text) {
              onSubmit(text);
              setDraft("");
            }
          }}
        >
          Run
        </button>
      </footer>
    );
  },
);
