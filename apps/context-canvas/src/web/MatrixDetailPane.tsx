import type { ReactElement } from "react";
import { formatColumnLabel } from "../shared/domain.ts";
import type { Cell } from "../shared/domain.ts";

export type DetailTab = "markdown" | "summary" | "provenance";

export interface DetailCellState {
  readonly row: number;
  readonly col: number;
  readonly body: string;
}

export interface MatrixDetailPaneProps {
  readonly detailCell: DetailCellState | null;
  readonly detailFrontmatter: string;
  readonly detailTab: DetailTab;
  readonly domainCell: Cell | null;
  readonly onTabChange: (tab: DetailTab) => void;
  readonly onBodyChange: (body: string) => void;
  readonly onSave: () => void;
  readonly onClear: () => void;
  readonly onFrontmatterChange: (frontmatter: string) => void;
}

function summarizeBody(body: string, maxLength = 280): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxLength) {
    return trimmed || "(empty body)";
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

export function MatrixDetailPane({
  detailCell,
  detailFrontmatter,
  detailTab,
  domainCell,
  onTabChange,
  onBodyChange,
  onSave,
  onClear,
  onFrontmatterChange,
}: MatrixDetailPaneProps): ReactElement {
  return (
    <aside className="matrix-detail-pane" data-testid="matrix-detail-pane">
      <div className="matrix-detail-tabs">
        {(["summary", "provenance", "markdown"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`matrix-detail-tab${detailTab === tab ? " active" : ""}`}
            data-testid={`detail-tab-${tab}`}
            aria-current={detailTab === tab ? "true" : undefined}
            onClick={() => onTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {detailCell ? (
        <div className="matrix-detail-content">
          <h3>
            Cell {formatColumnLabel(detailCell.col)}
            {detailCell.row + 1}
          </h3>

          {detailTab === "markdown" && (
            <>
              <label>
                Markdown body:
                <textarea
                  className="matrix-detail-textarea"
                  rows={10}
                  value={detailCell.body}
                  onChange={(event) => onBodyChange(event.target.value)}
                  data-testid="side-panel-textarea"
                />
              </label>
              <label>
                Frontmatter (YAML):
                <textarea
                  className="matrix-detail-textarea matrix-detail-frontmatter"
                  rows={4}
                  value={detailFrontmatter}
                  onChange={(event) => onFrontmatterChange(event.target.value)}
                  placeholder="status: draft"
                  data-testid="side-panel-frontmatter"
                />
              </label>
              <div className="matrix-detail-actions">
                <button type="button" onClick={onSave} data-testid="side-panel-save">
                  Save
                </button>
                <button type="button" onClick={onClear}>
                  Clear
                </button>
              </div>
            </>
          )}

          {detailTab === "summary" && (
            <div className="matrix-detail-readonly" data-testid="detail-summary-panel">
              <p>
                <strong>Value:</strong>{" "}
                {domainCell?.value === null || domainCell?.value === undefined
                  ? "(null)"
                  : String(domainCell.value)}
              </p>
              <p>
                <strong>Body preview:</strong>
              </p>
              <pre className="matrix-detail-preview">
                {summarizeBody(domainCell?.body ?? detailCell.body)}
              </pre>
              {domainCell?.frontmatter?.trim() ? (
                <>
                  <p>
                    <strong>Frontmatter:</strong>
                  </p>
                  <pre className="matrix-detail-preview">{domainCell.frontmatter}</pre>
                </>
              ) : null}
            </div>
          )}

          {detailTab === "provenance" && (
            <div className="matrix-detail-readonly" data-testid="detail-provenance-panel">
              <p>
                <strong>Provenance:</strong> {domainCell?.provenance?.trim() || "(none)"}
              </p>
              <p>
                <strong>Frontmatter (raw):</strong>
              </p>
              <pre className="matrix-detail-preview">
                {domainCell?.frontmatter?.trim() || "(empty)"}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="matrix-detail-empty">
          Select a cell to inspect Summary, Provenance, or Markdown.
        </p>
      )}
    </aside>
  );
}
