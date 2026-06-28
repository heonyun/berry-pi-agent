import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { DataEditor, type GridColumn, type GridSelection, type Item } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  cellKey,
  createEmptyMatrixDocument,
  findNamedRangeForSelection,
  formatColumnLabel,
  formatRangeLabel,
  rangesEqual,
  type MatrixDocument,
  type RangeRefDTO,
} from "../shared/domain.ts";
import { applyMatrixCommand, type MatrixCommand } from "../core/matrix-reducer.ts";
import { getCellContent, getMatrixGridConfig } from "../adapters/matrix-glide.ts";
import {
  compileMatrixRangeContext,
  type MatrixContextRange,
} from "../shared/compile-matrix-range-context.ts";
import { parseAiCommand } from "../shared/matrix-validation.ts";
import { runMatrix } from "./run-matrix.ts";

// ── Context Matrix Canvas ────────────────────────────────────────────────
// Phase 2: context vs target ranges, full compile, Summary/Provenance tabs.
// ─────────────────────────────────────────────────────────────────────────

type DetailTab = "markdown" | "summary" | "provenance";

interface ContextChip {
  readonly id: string;
  readonly label: string;
  readonly range: RangeRefDTO;
}

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

function rangeLabelForSelection(
  document: MatrixDocument,
  range: RangeRefDTO,
): string {
  const named = findNamedRangeForSelection(document, range);
  return named ? `@${named.name}` : formatRangeLabel(range.startCol, range.startRow, range.endCol, range.endRow);
}

function nextChipId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function summarizeBody(body: string, maxLength = 280): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxLength) {
    return trimmed || "(empty body)";
  }
  return `${trimmed.slice(0, maxLength)}…`;
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

  const [contextChips, setContextChips] = useState<ContextChip[]>([]);
  const [targetRange, setTargetRange] = useState<RangeRefDTO | null>(null);

  const [detailCell, setDetailCell] = useState<{
    row: number;
    col: number;
    body: string;
  } | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("markdown");

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
    if (!selectionRange) {
      return null;
    }
    return rangeLabelForSelection(document, selectionRange);
  }, [document, selectionRange]);

  const targetLabel = useMemo(() => {
    if (!targetRange) {
      return null;
    }
    return rangeLabelForSelection(document, targetRange);
  }, [document, targetRange]);

  const detailDomainCell = useMemo(() => {
    if (!detailCell) {
      return null;
    }
    return document.sheet.cells.get(cellKey(detailCell.row, detailCell.col)) ?? null;
  }, [detailCell, document]);

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

  const handleAddContext = useCallback(() => {
    if (!selectionRange || !selectionLabel) {
      setStatus("Select a range to add as context");
      return;
    }
    const duplicate = contextChips.some((chip) => rangesEqual(chip.range, selectionRange));
    if (duplicate) {
      setStatus("Context range already added");
      return;
    }
    setContextChips((chips) => [
      ...chips,
      { id: nextChipId(), label: selectionLabel, range: selectionRange },
    ]);
    setStatus(`Context added: ${selectionLabel}`);
  }, [contextChips, selectionLabel, selectionRange]);

  const handleRemoveContext = useCallback((chipId: string) => {
    setContextChips((chips) => chips.filter((chip) => chip.id !== chipId));
  }, []);

  const handleSetTarget = useCallback(() => {
    if (!selectionRange || !selectionLabel) {
      setStatus("Select a range to set as target");
      return;
    }
    setTargetRange(selectionRange);
    setStatus(`Target set: ${selectionLabel}`);
  }, [selectionLabel, selectionRange]);

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
    if (!targetRange) {
      setStatus("Set a target range before running");
      return;
    }
    if (!prompt.trim()) {
      setStatus("Enter a prompt before running");
      return;
    }

    setIsRunning(true);
    setStatus("Running matrix AI...");
    try {
      const contextRanges: MatrixContextRange[] = contextChips.map((chip) => ({
        label: chip.label,
        range: chip.range,
      }));

      const compiled = compileMatrixRangeContext(
        docRef.current,
        contextRanges,
        targetRange,
        prompt.trim(),
      );
      const response = await runMatrix({
        prompt: prompt.trim(),
        targetRange,
        compiled,
      });

      const parsed = parseAiCommand(response.command);
      if (!parsed.ok) {
        setStatus(`AI command validation failed: ${parsed.errors.message}`);
        return;
      }

      const result = dispatch({ type: "apply_ai_command", command: parsed.command });
      let message = `Run applied: ${result.meta.updatedCells} cells updated`;
      if (result.meta.strippedPatches) {
        message += ` — ${result.meta.strippedPatches} patch(es) outside target range skipped`;
      }
      setStatus(message);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Run failed: ${message}`);
    } finally {
      setIsRunning(false);
    }
  }, [contextChips, dispatch, prompt, targetRange]);

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
      setDetailTab("markdown");
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
          <div className="matrix-chip-row">
            {contextChips.map((chip) => (
              <span
                key={chip.id}
                className="matrix-context-chip"
                data-testid={`context-chip-${chip.label.replace(/^@/, "")}`}
              >
                ctx: {chip.label}
                <button
                  type="button"
                  className="matrix-chip-remove nodrag nopan"
                  aria-label={`Remove context ${chip.label}`}
                  onClick={() => handleRemoveContext(chip.id)}
                >
                  ×
                </button>
              </span>
            ))}
            {targetLabel && (
              <span className="matrix-target-chip" data-testid="target-range-chip">
                target: {targetLabel}
              </span>
            )}
          </div>

          <div className="matrix-composer-bar">
            <input
              className="matrix-composer-input nodrag nopan"
              type="text"
              placeholder={
                targetLabel
                  ? `Apply AI to ${targetLabel}...`
                  : "Set target range, add context, then run AI..."
              }
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isRunning}
              data-testid="matrix-composer-input"
            />

            <button
              type="button"
              className="matrix-context-add-button nodrag nopan"
              disabled={!selectionLabel || isRunning}
              onClick={handleAddContext}
              data-testid="matrix-add-context"
            >
              + Context
            </button>

            <button
              type="button"
              className="matrix-target-set-button nodrag nopan"
              disabled={!selectionLabel || isRunning}
              onClick={handleSetTarget}
              data-testid="matrix-set-target"
            >
              Set target
            </button>

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
              disabled={!targetRange || !prompt.trim() || isRunning}
              onClick={() => void handleRun()}
              data-testid="matrix-run"
            >
              {isRunning ? "Running..." : "Run"}
            </button>
          </div>
          <div className="matrix-composer-hint">
            Select range · + Context / Set target · name optionally · Run → POST /api/matrix-run
            {selectionLabel && <span> · selection: {selectionLabel}</span>}
          </div>
        </footer>

        <div className="v2-status-bar matrix-status-bar" aria-live="polite" data-testid="matrix-status-bar">
          <span>{status}</span>
          {targetLabel && <span className="v2-status-selection">Target: {targetLabel}</span>}
        </div>
      </div>

      <aside className="matrix-detail-pane" data-testid="matrix-detail-pane">
        <div className="matrix-detail-tabs">
          {(["summary", "provenance", "markdown"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`matrix-detail-tab${detailTab === tab ? " active" : ""}`}
              data-testid={`detail-tab-${tab}`}
              aria-current={detailTab === tab ? "true" : undefined}
              onClick={() => setDetailTab(tab)}
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
              </>
            )}

            {detailTab === "summary" && (
              <div className="matrix-detail-readonly" data-testid="detail-summary-panel">
                <p>
                  <strong>Value:</strong>{" "}
                  {detailDomainCell?.value === null || detailDomainCell?.value === undefined
                    ? "(null)"
                    : String(detailDomainCell.value)}
                </p>
                <p>
                  <strong>Body preview:</strong>
                </p>
                <pre className="matrix-detail-preview">
                  {summarizeBody(detailDomainCell?.body ?? detailCell.body)}
                </pre>
                {detailDomainCell?.frontmatter?.trim() ? (
                  <>
                    <p>
                      <strong>Frontmatter:</strong>
                    </p>
                    <pre className="matrix-detail-preview">{detailDomainCell.frontmatter}</pre>
                  </>
                ) : null}
              </div>
            )}

            {detailTab === "provenance" && (
              <div className="matrix-detail-readonly" data-testid="detail-provenance-panel">
                <p>
                  <strong>Provenance:</strong>{" "}
                  {detailDomainCell?.provenance?.trim() || "(none)"}
                </p>
                <p>
                  <strong>Frontmatter (raw):</strong>
                </p>
                <pre className="matrix-detail-preview">
                  {detailDomainCell?.frontmatter?.trim() || "(empty)"}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <p className="matrix-detail-empty">Select a cell to inspect Summary, Provenance, or Markdown.</p>
        )}
      </aside>
    </div>
  );
}
