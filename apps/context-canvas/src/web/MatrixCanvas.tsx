import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { DataEditor, type GridColumn, type GridSelection, type Item } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  cellKey,
  createEmptyMatrixDocument,
  findNamedRangeForSelection,
  formatColumnLabel,
  formatRangeLabel,
  type MatrixDocument,
  type RangeRefDTO,
} from "../shared/domain.ts";
import { applyMatrixCommand, type MatrixCommand } from "../core/matrix-reducer.ts";
import { getCellContent, getMatrixGridConfig } from "../adapters/matrix-glide.ts";
import { compileMatrixRangeContextStub } from "../shared/compile-matrix-range-context.ts";
import { parseAiCommand } from "../shared/matrix-validation.ts";
import { runMatrix } from "./run-matrix.ts";

// ── Context Matrix Canvas ────────────────────────────────────────────────
// Phase 1: named ranges, real /api/matrix-run, pinned Markdown detail pane.
// ─────────────────────────────────────────────────────────────────────────

function selectionToRangeRef(selection: {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}): RangeRefDTO {
  return {
    startRow: selection.startRow,
    startCol: selection.startCol,
    endRow: selection.endRow,
    endCol: selection.endCol,
  };
}

export function MatrixCanvas(): ReactElement {
  const [document, setDocument] = useState<MatrixDocument>(() => createEmptyMatrixDocument());
  const docRef = useRef(document);
  docRef.current = document;

  const [selection, setSelection] = useState<{
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
  } | null>(null);

  const [detailCell, setDetailCell] = useState<{
    row: number;
    col: number;
    body: string;
  } | null>(null);

  const [prompt, setPrompt] = useState("");
  const [rangeNameInput, setRangeNameInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("Ready");

  const config = useMemo(() => getMatrixGridConfig(document), [document]);

  const columns = useMemo(
    () =>
      Array.from({ length: config.cols }, (_, i) => ({
        id: String(i),
        title: formatColumnLabel(i),
        width: 120,
      })) as readonly GridColumn[],
    [config.cols],
  );

  const dispatch = useCallback((command: MatrixCommand) => {
    const result = applyMatrixCommand(docRef.current, command);
    docRef.current = result.document;
    setDocument(result.document);
    if (result.meta.message) {
      setStatus(result.meta.message);
    }
    return result;
  }, []);

  const cellContent = useMemo(() => getCellContent(document), [document]);

  const selectionRange = useMemo(
    () => (selection ? selectionToRangeRef(selection) : null),
    [selection],
  );

  const matchedNamedRange = useMemo(() => {
    if (!selectionRange) {
      return null;
    }
    return findNamedRangeForSelection(document, selectionRange) ?? null;
  }, [document, selectionRange]);

  const selectionLabel = useMemo(() => {
    if (!selection) {
      return null;
    }
    if (matchedNamedRange) {
      return `@${matchedNamedRange.name}`;
    }
    return formatRangeLabel(
      selection.startCol,
      selection.startRow,
      selection.endCol,
      selection.endRow,
    );
  }, [selection, matchedNamedRange]);

  const onGridSelectionChange = useCallback((newSelection: GridSelection) => {
    if (!newSelection.current) {
      setSelection(null);
      return;
    }
    const { range } = newSelection.current;
    if (range.width <= 0 || range.height <= 0) {
      setSelection(null);
      return;
    }
    setSelection({
      startCol: range.x,
      startRow: range.y,
      endCol: range.x + range.width - 1,
      endRow: range.y + range.height - 1,
    });
  }, []);

  const handleSaveNamedRange = useCallback(() => {
    if (!selectionRange) {
      setStatus("Select a range first");
      return;
    }
    const name = rangeNameInput.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
      setStatus("Range name must be slug-safe (a-z, 0-9, _, -)");
      return;
    }
    dispatch({
      type: "set_named_range",
      namedRange: { name, range: selectionRange },
    });
    setRangeNameInput("");
  }, [dispatch, rangeNameInput, selectionRange]);

  const handleRun = useCallback(async () => {
    if (!selectionRange) {
      setStatus("Select a range first");
      return;
    }
    if (!prompt.trim()) {
      setStatus("Enter a prompt before running");
      return;
    }

    setIsRunning(true);
    setStatus("Running matrix AI...");
    try {
      const compiled = compileMatrixRangeContextStub(
        docRef.current,
        selectionRange,
        prompt.trim(),
        matchedNamedRange ? [matchedNamedRange.name] : [],
      );
      const response = await runMatrix({
        prompt: prompt.trim(),
        targetRange: selectionRange,
        compiled,
      });

      const parsed = parseAiCommand(response.command);
      if (!parsed.ok) {
        setStatus(`AI command validation failed: ${parsed.errors.message}`);
        return;
      }

      const result = dispatch({ type: "apply_ai_command", command: parsed.command });
      setStatus(`Run applied: ${result.meta.updatedCells} cells updated`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Run failed: ${message}`);
    } finally {
      setIsRunning(false);
    }
  }, [dispatch, matchedNamedRange, prompt, selectionRange]);

  const handleDetailSave = useCallback(
    (row: number, col: number, body: string) => {
      dispatch({ type: "update_cell_body", row, col, body });
      setDetailCell({ row, col, body });
      setStatus(`Cell ${formatColumnLabel(col)}${row + 1} body updated`);
    },
    [dispatch],
  );

  const onCellClick = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) {
        return;
      }
      const key = cellKey(row, col);
      const domainCell = docRef.current.sheet.cells.get(key);
      setDetailCell({
        row,
        col,
        body: domainCell?.body ?? "",
      });
    },
    [config.rows, config.cols],
  );

  return (
    <div className="matrix-canvas">
      <div className="matrix-main">
        <div className="matrix-grid-container" data-testid="matrix-grid">
          <DataEditor
            getCellContent={cellContent}
            getCellsForSelection={true}
            columns={columns}
            rows={config.rows}
            rowMarkers="number"
            onCellClicked={onCellClick}
            onGridSelectionChange={onGridSelectionChange}
            rangeSelect="rect"
            smoothScrollX
            smoothScrollY
            height="100%"
            width="100%"
          />
        </div>

        <footer className="bottom-composer matrix-composer" data-testid="matrix-composer">
          <div className="matrix-composer-bar">
            {selectionLabel && (
              <span className="matrix-context-chip" data-testid="context-chip">
                {selectionLabel}
              </span>
            )}

            <input
              className="matrix-composer-input nodrag nopan"
              type="text"
              placeholder={selectionLabel ? `Apply AI on ${selectionLabel}...` : "Select a range, then run AI..."}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isRunning}
              data-testid="matrix-composer-input"
            />

            <input
              className="matrix-range-name-input nodrag nopan"
              type="text"
              placeholder="name range"
              value={rangeNameInput}
              onChange={(event) => setRangeNameInput(event.target.value)}
              disabled={!selectionLabel}
              data-testid="matrix-range-name-input"
            />

            <button
              type="button"
              className="matrix-name-range-button nodrag nopan"
              disabled={!selectionLabel || !rangeNameInput.trim()}
              onClick={handleSaveNamedRange}
              data-testid="matrix-name-range"
            >
              Name
            </button>

            <button
              type="button"
              className="matrix-composer-run nodrag nopan"
              disabled={!selectionLabel || !prompt.trim() || isRunning}
              onClick={() => void handleRun()}
              data-testid="matrix-run"
            >
              {isRunning ? "Running..." : "Run"}
            </button>
          </div>
          <div className="matrix-composer-hint">
            Select a range · name it optionally · enter prompt · Run calls POST /api/matrix-run
          </div>
        </footer>

        <div className="v2-status-bar matrix-status-bar" aria-live="polite" data-testid="matrix-status-bar">
          <span>{status}</span>
          {selectionLabel && <span className="v2-status-selection">Range: {selectionLabel}</span>}
        </div>
      </div>

      <aside className="matrix-detail-pane" data-testid="matrix-detail-pane">
        <div className="matrix-detail-tabs">
          <button
            type="button"
            className="matrix-detail-tab active"
            data-testid="detail-tab-markdown"
            aria-current="true"
          >
            Markdown
          </button>
        </div>

        {detailCell ? (
          <div className="matrix-detail-content">
            <h3>
              Cell {formatColumnLabel(detailCell.col)}
              {detailCell.row + 1}
            </h3>
            <label>
              Markdown body:
              <textarea
                className="matrix-detail-textarea"
                rows={14}
                value={detailCell.body}
                onChange={(event) =>
                  setDetailCell({ ...detailCell, body: event.target.value })
                }
                data-testid="side-panel-textarea"
              />
            </label>
            <div className="matrix-detail-actions">
              <button
                type="button"
                onClick={() =>
                  handleDetailSave(detailCell.row, detailCell.col, detailCell.body)
                }
                data-testid="side-panel-save"
              >
                Save
              </button>
              <button type="button" onClick={() => setDetailCell(null)}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <p className="matrix-detail-empty">Select a cell to edit markdown body.</p>
        )}
      </aside>
    </div>
  );
}
