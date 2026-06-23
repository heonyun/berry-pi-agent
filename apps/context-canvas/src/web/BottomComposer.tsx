import { useState } from "react";
import { ImeTextarea, stopNodeKeyPropagation } from "./ImeTextarea.tsx";

export interface BottomComposerProps {
  disabled?: boolean;
  onSubmit: (question: string) => void;
}

/** WHY: main question path is bottom-fixed; blocks stack upward from here (issue-39). */
export function BottomComposer({ disabled = false, onSubmit }: BottomComposerProps) {
  const [draft, setDraft] = useState("");

  return (
    <footer className="bottom-composer" aria-label="Canvas question input">
      <ImeTextarea
        className="bottom-composer-input nodrag nopan"
        value={draft}
        disabled={disabled}
        placeholder="Ask a question…"
        onValueChange={setDraft}
        onKeyDown={(event) => {
          stopNodeKeyPropagation(event);
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const text = draft.trim();
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
}
