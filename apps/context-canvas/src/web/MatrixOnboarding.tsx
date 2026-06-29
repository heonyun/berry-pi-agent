import { useCallback, useState, type ReactElement } from "react";

const STORAGE_KEY = "context-matrix-onboarding-dismissed";

export function MatrixOnboarding(): ReactElement | null {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return true;
    }
  });

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore quota / private mode
    }
    setDismissed(true);
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <div className="matrix-onboarding" data-testid="matrix-onboarding">
      <p className="matrix-onboarding-title">Welcome to Context Matrix</p>
      <ul className="matrix-onboarding-list">
        <li>Click a cell and type to enter text (like Excel)</li>
        <li>Drag or Shift+arrow to select a range</li>
        <li>Use AI below when you want to summarize or transform a range</li>
      </ul>
      <button type="button" className="matrix-onboarding-dismiss" onClick={handleDismiss}>
        Got it
      </button>
    </div>
  );
}
