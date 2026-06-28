import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { DataEditor, type GridColumn, type GridSelection, type Item } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { cellKey, createEmptyMatrixDocument, formatColumnLabel, formatRangeLabel, type MatrixDocument } from "../shared/domain.ts";
import { applyMatrixCommand, type MatrixCommand } from "../core/matrix-reducer.ts";
import { getCellContent, getMatrixGridConfig } from "../adapters/matrix-glide.ts";
import { parseAiCommand } from "../shared/matrix-validation.ts";

// ── Context Matrix Canvas ────────────────────────────────────────────────
// Renders a 20x50 glide-data-grid sheet with:
//   - Bottom composer showing a context chip for the selected range
//   - Mock AI command that produces validated WritePatch entries
//   - Side panel Markdown editing through command/reducer path
// ─────────────────────────────────────────────────────────────────────────

export function MatrixCanvas(): ReactElement {
  const [document, setDocument] = useState<MatrixDocument>(() => createEmptyMatrixDocument());
  const docRef = useRef(document);
  docRef.current = document;

  // Selection state (0-based column, 0-based row)
  const [selection, setSelection] = useState<{
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
  } | null>(null);

  // Side panel editing state
  const [sidePanelCell, setSidePanelCell] = useState<{
    row: number;
    col: number;
    body: string;
  } | null>(null);

  const [status, setStatus] = useState("Ready");

  const config = useMemo(() => getMatrixGridConfig(document), [document]);

  // Memoize grid columns to avoid recreating the array on every render
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

  // Selected range label for context chip
  const selectionLabel = useMemo(() => {
    if (!selection) return null;
    return formatRangeLabel(
      selection.startCol,
      selection.startRow,
      selection.endCol,
      selection.endRow,
    );
  }, [selection]);

  // Glide selection handler – reject empty / zero-area selections
  const onGridSelectionChange = useCallback(
    (newSelection: GridSelection) => {
      if (!newSelection.current) {
        setSelection(null);
        return;
      }
      const { range } = newSelection.current;
      // Reject zero-area or degenerate selections
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
    },
    [],
  );

  // Mock AI command submission – selection is wired into targetRange
  const handleMockAiCommand = useCallback(() => {
    if (!selection) {
      setStatus("Select a range first");
      return;
    }

    setStatus("Mock AI command running...");

    // Simulate AI producing patches for E2:E8 (col=4, rows=1..7)
    const mockPatches = [
      { row: 1, col: 4, value: "context-loaded" as const, body: "Context data loaded", provenance: "ai-v1" },
      { row: 2, col: 4, value: "analyzed" as const, body: "Analysis complete", provenance: "ai-v1" },
      { row: 3, col: 4, value: "ready" as const, body: "Ready for review", provenance: "ai-v1" },
      { row: 4, col: 4, value: "generated" as const, body: "Generated content", provenance: "ai-v1" },
      { row: 5, col: 4, value: "validated" as const, body: "Validation passed", provenance: "ai-v1" },
      { row: 6, col: 4, value: "applied" as const, body: "Changes applied", provenance: "ai-v1" },
      { row: 7, col: 4, value: "complete" as const, body: "Task complete", provenance: "ai-v1" },
    ];

    // Validate through Zod boundary; targetRange reflects the user-selected range
    const parsed = parseAiCommand({
      intent: `Fill cells E2:E8 with status values (user selected ${selectionLabel})`,
      targetRange: {
        startRow: selection.startRow,
        startCol: selection.startCol,
        endRow: selection.endRow,
        endCol: selection.endCol,
      },
      patches: mockPatches,
    });

    if (!parsed.ok) {
      setStatus(`AI command validation failed: ${parsed.errors.message}`);
      return;
    }

    const result = dispatch({
      type: "mock_ai_command",
      targetRange: {
        startRow: selection.startRow,
        startCol: selection.startCol,
        endRow: selection.endRow,
        endCol: selection.endCol,
      },
      patches: parsed.command.patches,
    });

    setStatus(`Mock AI command applied: ${result.meta.updatedCells} cells updated`);
  }, [dispatch, selection, selectionLabel]);

  // Side panel: commit body edit through command/reducer
  const handleSidePanelSave = useCallback(
    (row: number, col: number, body: string) => {
      dispatch({ type: "update_cell_body", row, col, body });
      setSidePanelCell(null);
      setStatus(`Cell (${col + 1},${row + 1}) body updated via side panel command`);
    },
    [dispatch],
  );

  // Grid cell click -> open side panel
  const onCellClick = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      // Ignore header clicks (row < 0) and out-of-bounds cells — editing is
      // owned by the side panel, not inline grid overlay
      if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) {
        return;
      }
      const key = cellKey(row, col);
      const domainCell = docRef.current.sheet.cells.get(key);
      setSidePanelCell({
        row,
        col,
        body: domainCell?.body ?? "",
      });
    },
    [config.rows, config.cols],
  );

  return (
    <div className="matrix-canvas">
      <div className="matrix-grid-container">
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

      <footer className="bottom-composer matrix-composer">
        <div className="matrix-composer-bar">
          {/* Context chip for selected range */}
          {selectionLabel && (
            <span className="matrix-context-chip" data-testid="context-chip">
              {selectionLabel}
            </span>
          )}

          <input
            className="matrix-composer-input nodrag nopan"
            type="text"
            placeholder={selectionLabel ? `Apply AI on ${selectionLabel}...` : "Select a range, then run AI..."}
            disabled
            data-testid="matrix-composer-input"
          />

          <button
            type="button"
            className="matrix-composer-run nodrag nopan"
            disabled={!selectionLabel}
            onClick={handleMockAiCommand}
            data-testid="mock-ai-run"
          >
            Mock AI
          </button>
        </div>
        <div className="matrix-composer-hint">
          Select a range to set AI context · Mock AI writes to E2:E8
        </div>
      </footer>

      {/* Side panel for Markdown editing */}
      {sidePanelCell && (
        <aside className="matrix-side-panel" data-testid="matrix-side-panel">
          <h3>Cell ({sidePanelCell.col + 1},{sidePanelCell.row + 1})</h3>
          <label>
            Markdown body:
            <textarea
              className="matrix-side-panel-textarea"
              rows={12}
              value={sidePanelCell.body}
              onChange={(e) =>
                setSidePanelCell({ ...sidePanelCell, body: e.target.value })
              }
              data-testid="side-panel-textarea"
            />
          </label>
          <div className="matrix-side-panel-actions">
            <button
              type="button"
              onClick={() =>
                handleSidePanelSave(sidePanelCell.row, sidePanelCell.col, sidePanelCell.body)
              }
              data-testid="side-panel-save"
            >
              Save
            </button>
            <button type="button" onClick={() => setSidePanelCell(null)}>
              Cancel
            </button>
          </div>
        </aside>
      )}

      {/* Status bar */}
      <div className="v2-status-bar" aria-live="polite">
        <span>{status}</span>
        {selectionLabel && (
          <span className="v2-status-selection">Range: {selectionLabel}</span>
        )}
      </div>
    </div>
  );
}
