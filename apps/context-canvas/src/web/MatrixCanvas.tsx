import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  cellKey,
  createEmptyMatrixDocument,
  findNamedRangeForSelection,
  formatRangeLabel,
  rangesEqual,
  type MatrixDocument,
  type MatrixHistoryEntry,
  type RangeRefDTO,
  type RecentRangeEntry,
} from "../shared/domain.ts";
import { applyMatrixCommand, type MatrixCommand } from "../core/matrix-reducer.ts";
import {
  compileMatrixRangeContext,
  type MatrixContextRange,
} from "../shared/compile-matrix-range-context.ts";
import { parseAiCommand } from "../shared/matrix-validation.ts";
import { runMatrix } from "./run-matrix.ts";
import { MatrixShell } from "./MatrixShell.tsx";
import { MatrixGrid } from "./MatrixGrid.tsx";
import { MatrixComposer, type ContextChip } from "./MatrixComposer.tsx";
import { MatrixDetailPane, type DetailTab, type DetailCellState } from "./MatrixDetailPane.tsx";
import { MatrixLeftNav } from "./MatrixLeftNav.tsx";
import { MatrixHistoryDetailPane } from "./MatrixHistoryDetailPane.tsx";
import { loadRecentRanges, recordRecentRange, saveRecentRanges } from "./matrix-recent-ranges.ts";
import {
  appendMatrixHistory,
  createHistoryEntry,
  loadMatrixHistory,
  saveMatrixHistory,
  summarizePatches,
  truncatePreview,
} from "./matrix-history.ts";

// ── Context Matrix Canvas ────────────────────────────────────────────────
// Phase 4b: run history in left nav + read-only detail + re-run pre-fill.
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

function rangeLabelForSelection(document: MatrixDocument, range: RangeRefDTO): string {
  const named = findNamedRangeForSelection(document, range);
  return named
    ? `@${named.name}`
    : formatRangeLabel(range.startCol, range.startRow, range.endCol, range.endRow);
}

function nextChipId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

  const [detailCell, setDetailCell] = useState<DetailCellState | null>(null);
  const [detailFrontmatter, setDetailFrontmatter] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("markdown");

  const [prompt, setPrompt] = useState("");
  const [rangeNameInput, setRangeNameInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("Ready");

  const [recentRanges, setRecentRanges] = useState<RecentRangeEntry[]>(() => loadRecentRanges());
  const [historyEntries, setHistoryEntries] = useState<MatrixHistoryEntry[]>(() => loadMatrixHistory());
  const [selectedHistory, setSelectedHistory] = useState<MatrixHistoryEntry | null>(null);

  useEffect(() => {
    saveRecentRanges(recentRanges);
  }, [recentRanges]);

  useEffect(() => {
    saveMatrixHistory(historyEntries);
  }, [historyEntries]);

  const dispatch = useCallback((command: MatrixCommand) => {
    const result = applyMatrixCommand(docRef.current, command);
    docRef.current = result.document;
    setDocument(result.document);
    if (result.meta.message) {
      setStatus(result.meta.message);
    }
    return result;
  }, []);

  const selectionRange = useMemo(
    () => (selection ? selectionToRangeRef(selection) : null),
    [selection],
  );

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
    const cell = document.sheet.cells.get(cellKey(detailCell.row, detailCell.col)) ?? null;
    if (cell && detailFrontmatter !== cell.frontmatter) {
      return { ...cell, frontmatter: detailFrontmatter };
    }
    return cell;
  }, [detailCell, detailFrontmatter, document]);

  const touchRecentRange = useCallback((name: string, rangeLabel: string) => {
    setRecentRanges((entries) => recordRecentRange(entries, { name, rangeLabel }));
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
    touchRecentRange(selectionLabel.replace(/^@/, ""), selectionLabel);
    setStatus(`Context added: ${selectionLabel}`);
  }, [contextChips, selectionLabel, selectionRange, touchRecentRange]);

  const handleRemoveContext = useCallback((chipId: string) => {
    setContextChips((chips) => chips.filter((chip) => chip.id !== chipId));
  }, []);

  const handleMoveContextUp = useCallback((chipId: string) => {
    setContextChips((chips) => {
      const index = chips.findIndex((chip) => chip.id === chipId);
      if (index <= 0) {
        return chips;
      }
      const next = [...chips];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item);
      return next;
    });
  }, []);

  const handleSetTarget = useCallback(() => {
    if (!selectionRange || !selectionLabel) {
      setStatus("Select a range to set as target");
      return;
    }
    setTargetRange(selectionRange);
    touchRecentRange(`target:${selectionLabel.replace(/^@/, "")}`, selectionLabel);
    setStatus(`Target set: ${selectionLabel}`);
  }, [selectionLabel, selectionRange, touchRecentRange]);

  const handleSaveNamedRange = useCallback(() => {
    if (!selectionRange || !selectionLabel) {
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
    touchRecentRange(name, `@${name}`);
    setRangeNameInput("");
  }, [dispatch, rangeNameInput, selectionLabel, selectionRange, touchRecentRange]);

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
      if (targetLabel) {
        touchRecentRange(`run:${targetLabel.replace(/^@/, "")}`, targetLabel);
      }

      const historyEntry = createHistoryEntry({
        intent: prompt.trim(),
        contextRanges: contextChips.map((chip) => ({ label: chip.label, range: chip.range })),
        targetRange,
        targetRangeLabel: targetLabel ?? compiled.targetRangeLabel,
        patchesApplied: result.meta.updatedCells,
        compiledContextPreview: truncatePreview(compiled.contextText),
        patchesSummary: summarizePatches(parsed.command),
      });
      setHistoryEntries((entries) => appendMatrixHistory(entries, historyEntry));
      setSelectedHistory(historyEntry);

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
  }, [contextChips, dispatch, prompt, targetLabel, targetRange, touchRecentRange]);

  const handleDetailSave = useCallback(
    (row: number, col: number, body: string, frontmatter: string) => {
      dispatch({ type: "update_cell_body", row, col, body });
      dispatch({ type: "update_cell_frontmatter", row, col, frontmatter });
      setDetailCell({ row, col, body });
      setDetailFrontmatter(frontmatter);
      setStatus(`Cell updated`);
    },
    [dispatch],
  );

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedHistory(null);
    const key = cellKey(row, col);
    const domainCell = docRef.current.sheet.cells.get(key);
    setDetailCell({
      row,
      col,
      body: domainCell?.body ?? "",
    });
    setDetailFrontmatter(domainCell?.frontmatter ?? "");
    setDetailTab("markdown");
  }, []);

  const handleHistorySelect = useCallback((entry: MatrixHistoryEntry) => {
    setSelectedHistory(entry);
    setDetailCell(null);
    setDetailFrontmatter("");
  }, []);

  const handleHistoryClose = useCallback(() => {
    setSelectedHistory(null);
  }, []);

  const handleHistoryRerun = useCallback((entry: MatrixHistoryEntry) => {
    setPrompt(entry.intent);
    setContextChips(
      entry.contextRanges.map((range) => ({
        id: nextChipId(),
        label: range.label,
        range: range.range,
      })),
    );
    setTargetRange(entry.targetRange);
    setSelectedHistory(null);
    setStatus("Composer pre-filled from history — review and Run");
  }, []);

  const handleRecentSelect = useCallback(
    (entry: RecentRangeEntry) => {
      const named = document.namedRanges.get(entry.name);
      if (named) {
        setSelection({
          startRow: named.range.startRow,
          startCol: named.range.startCol,
          endRow: named.range.endRow,
          endCol: named.range.endCol,
        });
        setStatus(`Selected recent range: ${entry.rangeLabel}`);
        touchRecentRange(entry.name, entry.rangeLabel);
        return;
      }
      setStatus(`Recent range "${entry.name}" — select matching cells on grid`);
    },
    [document.namedRanges, touchRecentRange],
  );

  return (
    <MatrixShell
      leftNav={
        <MatrixLeftNav
          recentEntries={recentRanges}
          historyEntries={historyEntries}
          selectedHistoryId={selectedHistory?.id ?? null}
          onRecentSelect={handleRecentSelect}
          onHistorySelect={handleHistorySelect}
        />
      }
      center={
        <div className="matrix-main">
          <MatrixGrid
            document={document}
            onCellClick={handleCellClick}
            onSelectionChange={setSelection}
          />

          <MatrixComposer
            contextChips={contextChips}
            targetLabel={targetLabel}
            selectionLabel={selectionLabel}
            prompt={prompt}
            rangeNameInput={rangeNameInput}
            isRunning={isRunning}
            hasTarget={targetRange !== null}
            onPromptChange={setPrompt}
            onRangeNameChange={setRangeNameInput}
            onAddContext={handleAddContext}
            onRemoveContext={handleRemoveContext}
            onMoveContextUp={handleMoveContextUp}
            onSetTarget={handleSetTarget}
            onSaveNamedRange={handleSaveNamedRange}
            onRun={() => void handleRun()}
          />

          <div
            className="v2-status-bar matrix-status-bar"
            aria-live="polite"
            data-testid="matrix-status-bar"
          >
            <span>{status}</span>
            {document.template && (
              <span className="v2-status-selection">Template: {document.template.name}</span>
            )}
            {targetLabel && <span className="v2-status-selection">Target: {targetLabel}</span>}
          </div>
        </div>
      }
      detailPane={
        selectedHistory ? (
          <MatrixHistoryDetailPane
            entry={selectedHistory}
            onClose={handleHistoryClose}
            onRerun={handleHistoryRerun}
          />
        ) : (
          <MatrixDetailPane
            detailCell={detailCell}
            detailFrontmatter={detailFrontmatter}
            detailTab={detailTab}
            domainCell={detailDomainCell}
            onTabChange={setDetailTab}
            onBodyChange={(body) => detailCell && setDetailCell({ ...detailCell, body })}
            onFrontmatterChange={setDetailFrontmatter}
            onSave={() =>
              detailCell &&
              handleDetailSave(detailCell.row, detailCell.col, detailCell.body, detailFrontmatter)
            }
            onClear={() => {
              setDetailCell(null);
              setDetailFrontmatter("");
            }}
          />
        )
      }
    />
  );
}
