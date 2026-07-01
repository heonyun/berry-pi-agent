import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  cellKey,
  createEmptyMatrixDocument,
  findNamedRangeForSelection,
  formatColumnLabel,
  formatRangeLabel,
  formatSelectionSummary,
  rangesEqual,
  type Cell,
  type MatrixDocument,
  type MatrixHistoryEntry,
  type RangeRefDTO,
  type RecentRangeEntry,
  type WritePatch,
} from "../shared/domain.ts";
import { applyMatrixCommand, type MatrixCommand } from "../core/matrix-reducer.ts";
import {
  compileMatrixRangeContext,
  type MatrixContextRange,
} from "../shared/compile-matrix-range-context.ts";
import { bindAiCommandToUserTarget, parseAiCommand } from "../shared/matrix-validation.ts";
import { runMatrix } from "./run-matrix.ts";
import { MatrixShell } from "./MatrixShell.tsx";
import { MatrixGrid, type MatrixCellEdit, type MatrixGridSelectionState } from "./MatrixGrid.tsx";
import { MatrixComposer, type ContextChip } from "./MatrixComposer.tsx";
import { MatrixDetailPane, type DetailTab, type DetailCellState } from "./MatrixDetailPane.tsx";
import { MatrixLeftNav } from "./MatrixLeftNav.tsx";
import { MatrixHistoryDetailPane } from "./MatrixHistoryDetailPane.tsx";
import { MatrixOnboarding } from "./MatrixOnboarding.tsx";
import { loadRecentRanges, recordRecentRange, saveRecentRanges } from "./matrix-recent-ranges.ts";
import {
  appendMatrixHistory,
  createHistoryEntry,
  loadMatrixHistory,
  saveMatrixHistory,
  summarizePatches,
  truncatePreview,
} from "./matrix-history.ts";
import { scheduleMatrixBundleExport } from "./export-matrix-bundle.ts";

function selectionToRangeRef(selection: MatrixGridSelectionState): RangeRefDTO {
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

  const [selection, setSelection] = useState<MatrixGridSelectionState | null>(null);

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

  const syncDetailFromActiveCell = useCallback((row: number, col: number) => {
    setSelectedHistory(null);
    const key = cellKey(row, col);
    const domainCell = docRef.current.sheet.cells.get(key);
    setDetailCell({
      row,
      col,
      body: domainCell?.body ?? "",
    });
    setDetailFrontmatter(domainCell?.frontmatter ?? "");
  }, []);

  const handleSelectionChange = useCallback(
    (next: MatrixGridSelectionState | null) => {
      setSelection(next);
      if (next) {
        syncDetailFromActiveCell(next.activeRow, next.activeCol);
      }
    },
    [syncDetailFromActiveCell],
  );

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

  const selectionSummary = useMemo(() => {
    if (!selectionRange) {
      return null;
    }
    return formatSelectionSummary(selectionRange);
  }, [selectionRange]);

  const selectionIsMultiCell = useMemo(() => {
    if (!selectionRange) {
      return false;
    }
    const width = selectionRange.endCol - selectionRange.startCol + 1;
    const height = selectionRange.endRow - selectionRange.startRow + 1;
    return width * height > 1;
  }, [selectionRange]);

  const hasCellContent = useMemo(() => document.sheet.cells.size > 0, [document]);

  const showAiSection = Boolean(
    selectionRange || targetRange || contextChips.length > 0 || hasCellContent,
  );

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
    const base: Cell = cell ?? {
      value: null,
      body: "",
      frontmatter: "",
      provenance: undefined,
    };
    const body = detailCell.body;
    const frontmatter = detailFrontmatter;
    if (cell && body === cell.body && frontmatter === cell.frontmatter) {
      return cell;
    }
    return { ...base, body, frontmatter };
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

      const { command: boundCommand, strippedCount } = bindAiCommandToUserTarget(
        parsed.command,
        targetRange,
      );
      const result = dispatch({ type: "apply_ai_command", command: boundCommand });
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
        patchesSummary: summarizePatches(boundCommand),
      });
      const nextHistory = appendMatrixHistory(historyEntries, historyEntry);
      setHistoryEntries(nextHistory);
      scheduleMatrixBundleExport(docRef.current, nextHistory);
      setDetailCell(null);
      setDetailFrontmatter("");
      setSelectedHistory(historyEntry);

      let message = `Run applied: ${result.meta.updatedCells} cells updated`;
      if (strippedCount > 0) {
        message += ` — ${strippedCount} patch(es) outside target range skipped`;
      }
      setStatus(message);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Run failed: ${message}`);
    } finally {
      setIsRunning(false);
    }
  }, [contextChips, dispatch, historyEntries, prompt, targetLabel, targetRange, touchRecentRange]);

  const handleDetailSave = useCallback(
    (row: number, col: number, body: string, frontmatter: string) => {
      dispatch({ type: "update_cell_body", row, col, body });
      dispatch({ type: "update_cell_frontmatter", row, col, frontmatter });
      setDetailCell({ row, col, body });
      setDetailFrontmatter(frontmatter);
      const label = `${formatColumnLabel(col)}${row + 1}`;
      setStatus(`Cell ${label} updated`);
    },
    [dispatch],
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      syncDetailFromActiveCell(row, col);
      setDetailTab("markdown");
    },
    [syncDetailFromActiveCell],
  );

  const handleCellEdited = useCallback(
    (row: number, col: number, body: string) => {
      dispatch({ type: "update_cell_body", row, col, body });
      setDetailCell({ row, col, body });
      const label = `${formatColumnLabel(col)}${row + 1}`;
      setStatus(`Cell ${label} updated`);
    },
    [dispatch],
  );

  const handleCellsEdited = useCallback(
    (edits: readonly MatrixCellEdit[]) => {
      if (edits.length === 0) {
        return;
      }

      const patches: WritePatch[] = edits.map((edit) => {
        const existing = docRef.current.sheet.cells.get(cellKey(edit.row, edit.col));
        return {
          row: edit.row,
          col: edit.col,
          value: existing?.value ?? null,
          body: edit.body,
          ...(existing?.frontmatter ? { frontmatter: existing.frontmatter } : {}),
          ...(existing?.provenance ? { provenance: existing.provenance } : {}),
        };
      });
      dispatch({ type: "apply_patches", patches });

      const activeEdit = selection
        ? edits.find((edit) => edit.row === selection.activeRow && edit.col === selection.activeCol)
        : undefined;
      const detailEdit = activeEdit ?? edits[0];
      setDetailCell({ row: detailEdit.row, col: detailEdit.col, body: detailEdit.body });
      const label = `${formatColumnLabel(detailEdit.col)}${detailEdit.row + 1}`;
      setStatus(edits.length === 1 ? `Cell ${label} updated` : `${edits.length} cells updated`);
    },
    [dispatch, selection],
  );

  const handleQuickSummarize = useCallback(() => {
    if (!selectionRange || !selectionLabel) {
      setStatus("Select a range to summarize");
      return;
    }
    const width = selectionRange.endCol - selectionRange.startCol + 1;
    const height = selectionRange.endRow - selectionRange.startRow + 1;
    if (width * height < 2) {
      setStatus("Select at least two cells to summarize into a target");
      return;
    }
    const duplicate = contextChips.some((chip) => rangesEqual(chip.range, selectionRange));
    if (!duplicate) {
      setContextChips((chips) => [
        ...chips,
        { id: nextChipId(), label: selectionLabel, range: selectionRange },
      ]);
      touchRecentRange(selectionLabel.replace(/^@/, ""), selectionLabel);
    }
    setTargetRange(selectionRange);
    touchRecentRange(`target:${selectionLabel.replace(/^@/, "")}`, selectionLabel);
    setPrompt("Summarize the selected context into this target cell.");
    setStatus(`AI ready for ${selectionLabel} — review and Run`);
  }, [contextChips, selectionLabel, selectionRange, touchRecentRange]);

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
        const nextSelection: MatrixGridSelectionState = {
          startRow: named.range.startRow,
          startCol: named.range.startCol,
          endRow: named.range.endRow,
          endCol: named.range.endCol,
          activeRow: named.range.startRow,
          activeCol: named.range.startCol,
        };
        setSelection(nextSelection);
        syncDetailFromActiveCell(nextSelection.activeRow, nextSelection.activeCol);
        setStatus(`Selected recent range: ${entry.rangeLabel}`);
        touchRecentRange(entry.name, entry.rangeLabel);
        return;
      }
      setStatus(`Recent range "${entry.name}" — select matching cells on grid`);
    },
    [document.namedRanges, syncDetailFromActiveCell, touchRecentRange],
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
          <div className="matrix-grid-wrap">
            <MatrixGrid
              document={document}
              selection={selection}
              onCellClick={handleCellClick}
              onCellEdited={handleCellEdited}
              onCellsEdited={handleCellsEdited}
              onSelectionChange={handleSelectionChange}
            />
            <MatrixOnboarding />
          </div>

          <MatrixComposer
            contextChips={contextChips}
            targetLabel={targetLabel}
            selectionLabel={selectionLabel}
            selectionSummary={selectionSummary}
            selectionIsMultiCell={selectionIsMultiCell}
            prompt={prompt}
            rangeNameInput={rangeNameInput}
            isRunning={isRunning}
            hasTarget={targetRange !== null}
            showAiSection={showAiSection}
            onPromptChange={setPrompt}
            onRangeNameChange={setRangeNameInput}
            onAddContext={handleAddContext}
            onRemoveContext={handleRemoveContext}
            onMoveContextUp={handleMoveContextUp}
            onSetTarget={handleSetTarget}
            onSaveNamedRange={handleSaveNamedRange}
            onQuickSummarize={handleQuickSummarize}
            onRun={() => void handleRun()}
          />

          <div className="matrix-status-bar" aria-live="polite" data-testid="matrix-status-bar">
            <span>{status}</span>
            {selectionSummary && (
              <span className="v2-status-selection" data-testid="matrix-status-selection">
                Selection: {selectionSummary}
              </span>
            )}
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
