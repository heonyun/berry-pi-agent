import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  cellKey,
  createEmptyMatrixDocument,
  findNamedRangeForSelection,
  formatColumnLabel,
  formatRangeLabel,
  formatSelectionSummary,
  getColumnCustomLabel,
  rangesEqual,
  type Cell,
  type MatrixGroup,
  type MatrixDocument,
  type MatrixHistoryEntry,
  type RangeRefDTO,
  type WritePatch,
} from "../shared/domain.ts";
import { visibleMatrixGroups } from "../shared/matrix-groups.ts";
import { applyMatrixCommand, type MatrixCommand } from "../core/matrix-reducer.ts";
import {
  compileMatrixRangeContext,
  type MatrixContextRange,
} from "../shared/compile-matrix-range-context.ts";
import {
  inferMatrixTargetRange,
  type MatrixTargetDirection,
} from "../shared/matrix-target-inference.ts";
import { bindAiCommandToUserTarget, parseAiCommand } from "../shared/matrix-validation.ts";
import { runMatrix } from "./run-matrix.ts";
import { MatrixShell } from "./MatrixShell.tsx";
import { MatrixGrid, type MatrixCellEdit, type MatrixGridSelectionState } from "./MatrixGrid.tsx";
import { MatrixComposer, type ContextChip } from "./MatrixComposer.tsx";
import { MatrixDetailPane, type DetailTab, type DetailCellState } from "./MatrixDetailPane.tsx";
import { MatrixLeftNav } from "./MatrixLeftNav.tsx";
import { MatrixHistoryDetailPane } from "./MatrixHistoryDetailPane.tsx";
import { MatrixOnboarding } from "./MatrixOnboarding.tsx";
import { loadMatrixPanelLayout, saveMatrixPanelLayout } from "./matrix-panel-layout.ts";
import { loadMatrixColumnWidths, saveMatrixColumnWidths } from "./matrix-column-widths.ts";
import {
  appendMatrixHistory,
  createHistoryEntry,
  loadMatrixHistory,
  saveMatrixHistory,
  summarizePatches,
  truncatePreview,
} from "./matrix-history.ts";
import { scheduleMatrixBundleExport } from "./export-matrix-bundle.ts";
import {
  matrixShortcutBlockedStatus,
  matrixShortcutDirection,
  shouldHandleMatrixShortcut,
} from "../shared/matrix-shortcut.ts";

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
  const [document, setDocument] = useState<MatrixDocument>(() => {
    const storedWidths = loadMatrixColumnWidths();
    const base = createEmptyMatrixDocument();
    if (storedWidths.size === 0) {
      return base;
    }
    return { ...base, columnWidths: storedWidths };
  });
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
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [columnLabelDraft, setColumnLabelDraft] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupLabelDraft, setGroupLabelDraft] = useState("");
  const [panelLayout, setPanelLayout] = useState(() => loadMatrixPanelLayout());

  const [historyEntries, setHistoryEntries] = useState<MatrixHistoryEntry[]>(() => loadMatrixHistory());
  const [selectedHistory, setSelectedHistory] = useState<MatrixHistoryEntry | null>(null);

  const groups = useMemo(() => visibleMatrixGroups(document), [document]);

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

  const selectedColumnIndex = useMemo(() => {
    if (!selectionRange) {
      return null;
    }
    const isWholeColumn =
      selectionRange.startRow === 0 &&
      selectionRange.endRow === document.sheet.rows - 1 &&
      selectionRange.startCol === selectionRange.endCol;
    return isWholeColumn ? selectionRange.startCol : null;
  }, [document.sheet.rows, selectionRange]);

  const selectedGroupId = useMemo(() => {
    if (!selectionRange) {
      return null;
    }
    const group = groups.find((entry) => rangesEqual(entry.range, selectionRange));
    return group?.id ?? null;
  }, [groups, selectionRange]);

  useEffect(() => {
    if (editingColumn !== null && selectedColumnIndex !== editingColumn) {
      setEditingColumn(null);
      setColumnLabelDraft("");
    }
  }, [editingColumn, selectedColumnIndex]);

  useEffect(() => {
    if (editingGroupId !== null && !groups.some((group) => group.id === editingGroupId)) {
      // RISK: Auto group IDs can disappear after cell edits; keeping the editor open would
      // save into a no-op reducer path and make the label input feel stuck.
      setEditingGroupId(null);
      setGroupLabelDraft("");
    }
  }, [editingGroupId, groups]);

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

  const toggleLeftPanel = useCallback(() => {
    setPanelLayout((current) => {
      const next = { ...current, leftCollapsed: !current.leftCollapsed };
      saveMatrixPanelLayout(next);
      return next;
    });
  }, []);

  const toggleRightPanel = useCallback(() => {
    setPanelLayout((current) => {
      const next = { ...current, rightCollapsed: !current.rightCollapsed };
      saveMatrixPanelLayout(next);
      return next;
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

  const addContextForGroup = useCallback(
    (group: MatrixGroup) => {
      const duplicate = contextChips.some((chip) => rangesEqual(chip.range, group.range));
      if (duplicate) {
        setStatus("Context group already added");
        return;
      }
      setContextChips((chips) => [
        ...chips,
        { id: nextChipId(), label: group.label, range: group.range },
      ]);
      setStatus(`Context added: ${group.label}`);
    },
    [contextChips],
  );

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
    setStatus(`Target set: ${selectionLabel}`);
  }, [selectionLabel, selectionRange]);

  const handleStartColumnLabelEdit = useCallback(
    (col: number) => {
      setEditingColumn(col);
      setColumnLabelDraft(getColumnCustomLabel(docRef.current, col));
      setStatus(`Editing column ${formatColumnLabel(col)} label`);
    },
    [],
  );

  const handleColumnHeaderClick = useCallback(
    (col: number, options: { readonly isDoubleClick: boolean }) => {
      if (options.isDoubleClick) {
        handleStartColumnLabelEdit(col);
        return;
      }
      if (editingColumn !== null) {
        setEditingColumn(null);
        setColumnLabelDraft("");
      }
    },
    [editingColumn, handleStartColumnLabelEdit],
  );

  const handleSaveColumnLabel = useCallback(() => {
    if (editingColumn === null) {
      return;
    }
    dispatch({
      type: "set_column_custom_label",
      col: editingColumn,
      label: columnLabelDraft,
    });
    setEditingColumn(null);
    setColumnLabelDraft("");
  }, [columnLabelDraft, dispatch, editingColumn]);

  const handleStartGroupLabelEdit = useCallback((group: MatrixGroup) => {
    setEditingGroupId(group.id);
    setGroupLabelDraft(group.label);
    setStatus(`Editing group label: ${group.label}`);
  }, []);

  const handleSaveGroupLabel = useCallback(() => {
    if (!editingGroupId) {
      return;
    }
    dispatch({
      type: "set_group_label",
      id: editingGroupId,
      label: groupLabelDraft,
    });
    setEditingGroupId(null);
    setGroupLabelDraft("");
  }, [dispatch, editingGroupId, groupLabelDraft]);

  const handleClearColumnLabel = useCallback(() => {
    if (editingColumn === null) {
      return;
    }
    dispatch({
      type: "set_column_custom_label",
      col: editingColumn,
      label: "",
    });
    setEditingColumn(null);
    setColumnLabelDraft("");
  }, [dispatch, editingColumn]);

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
    setRangeNameInput("");
  }, [dispatch, rangeNameInput, selectionLabel, selectionRange]);

  const runWithTarget = useCallback(
    async (runTargetRange: RangeRefDTO, runContextChips: readonly ContextChip[]) => {
      if (!prompt.trim()) {
        setStatus("Enter a prompt before running");
        return;
      }

      const runTargetLabel = rangeLabelForSelection(docRef.current, runTargetRange);
      setIsRunning(true);
      setStatus("Running matrix AI...");
      try {
        const contextRanges: MatrixContextRange[] = runContextChips.map((chip) => ({
          label: chip.label,
          range: chip.range,
        }));

        const compiled = compileMatrixRangeContext(
          docRef.current,
          contextRanges,
          runTargetRange,
          prompt.trim(),
        );
        const response = await runMatrix({
          prompt: prompt.trim(),
          targetRange: runTargetRange,
          compiled,
        });

        const parsed = parseAiCommand(response.command);
        if (!parsed.ok) {
          setStatus(`AI command validation failed: ${parsed.errors.message}`);
          return;
        }

        const { command: boundCommand, strippedCount } = bindAiCommandToUserTarget(
          parsed.command,
          runTargetRange,
        );
        const result = dispatch({ type: "apply_ai_command", command: boundCommand });

        const historyEntry = createHistoryEntry({
          intent: prompt.trim(),
          contextRanges: runContextChips.map((chip) => ({ label: chip.label, range: chip.range })),
          targetRange: runTargetRange,
          targetRangeLabel: runTargetLabel ?? compiled.targetRangeLabel,
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
    },
    [dispatch, historyEntries, prompt],
  );

  const handleRun = useCallback(async () => {
    if (!targetRange) {
      setStatus("Set a target range before running");
      return;
    }
    await runWithTarget(targetRange, contextChips);
  }, [contextChips, runWithTarget, targetRange]);

  const contextChipsWithSelection = useCallback(
    (
      baseChips: readonly ContextChip[],
    ): { readonly chips: readonly ContextChip[]; readonly added: boolean } => {
      if (!selectionRange || !selectionLabel) {
        return { chips: baseChips, added: false };
      }
      const duplicate = baseChips.some((chip) => rangesEqual(chip.range, selectionRange));
      if (duplicate) {
        return { chips: baseChips, added: false };
      }
      return {
        chips: [...baseChips, { id: nextChipId(), label: selectionLabel, range: selectionRange }],
        added: true,
      };
    },
    [selectionLabel, selectionRange],
  );

  const handleMatrixShortcutRun = useCallback(
    (direction: MatrixTargetDirection) => {
      if (isRunning) {
        return;
      }
      if (!prompt.trim()) {
        setStatus("Enter a prompt before running");
        return;
      }
      if (targetRange) {
        if (direction === "right") {
          setStatus("Target already set");
          return;
        }
        void runWithTarget(targetRange, contextChips);
        return;
      }
      if (!selectionRange || !selectionLabel) {
        setStatus("Select a range before running");
        return;
      }

      const inferred = inferMatrixTargetRange(selectionRange, direction, {
        rows: docRef.current.sheet.rows,
        cols: docRef.current.sheet.cols,
      });
      if (!inferred.ok) {
        setStatus(
          inferred.reason === "no-room-below"
            ? "No room below selection for target"
            : "No room right of selection for target",
        );
        return;
      }

      const nextContext = contextChipsWithSelection(contextChips);
      if (nextContext.added) {
        setContextChips([...nextContext.chips]);
      }
      const inferredLabel = rangeLabelForSelection(docRef.current, inferred.targetRange);
      setTargetRange(inferred.targetRange);
      void runWithTarget(inferred.targetRange, nextContext.chips);
    },
    [
      contextChips,
      contextChipsWithSelection,
      isRunning,
      prompt,
      runWithTarget,
      selectionLabel,
      selectionRange,
      targetRange,
    ],
  );
  const handleMatrixShortcutRunRef = useRef(handleMatrixShortcutRun);
  handleMatrixShortcutRunRef.current = handleMatrixShortcutRun;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }
      if (event.repeat) {
        return;
      }
      const direction = matrixShortcutDirection(event);
      if (!direction) {
        return;
      }
      if (shouldHandleMatrixShortcut(event.target)) {
        event.preventDefault();
        handleMatrixShortcutRunRef.current(direction);
        return;
      }
      // WHY: silent no-op confused manual testers; surface preconditions (#94).
      const blockedStatus = matrixShortcutBlockedStatus(event.target);
      if (blockedStatus) {
        event.preventDefault();
        setStatusRef.current(blockedStatus);
      }
    };
    window.document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

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
    }
    setTargetRange(selectionRange);
    setPrompt("Summarize the selected context into this target cell.");
    setStatus(`AI ready for ${selectionLabel} — review and Run`);
  }, [contextChips, selectionLabel, selectionRange]);

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

  const handleGroupSelect = useCallback(
    (group: MatrixGroup) => {
      const nextSelection: MatrixGridSelectionState = {
        startRow: group.range.startRow,
        startCol: group.range.startCol,
        endRow: group.range.endRow,
        endCol: group.range.endCol,
        activeRow: group.range.startRow,
        activeCol: group.range.startCol,
      };
      setSelection(nextSelection);
      syncDetailFromActiveCell(nextSelection.activeRow, nextSelection.activeCol);
      setStatus(`Selected group: ${group.label}`);
    },
    [syncDetailFromActiveCell],
  );

  // WHY: column headers use double-click to rename; single click selects only (#95).
  const handleGroupLabelClick = useCallback(
    (group: MatrixGroup, options: { readonly isDoubleClick: boolean }) => {
      if (options.isDoubleClick) {
        handleStartGroupLabelEdit(group);
        return;
      }
      if (editingGroupId !== null) {
        setEditingGroupId(null);
        setGroupLabelDraft("");
      }
      handleGroupSelect(group);
    },
    [editingGroupId, handleGroupSelect, handleStartGroupLabelEdit],
  );

  const handleColumnWidthChange = useCallback(
    (col: number, width: number) => {
      const result = dispatch({ type: "set_column_width", col, width });
      saveMatrixColumnWidths(result.document.columnWidths);
      scheduleMatrixBundleExport(result.document, historyEntries);
    },
    [dispatch, historyEntries],
  );

  const handleGroupDismiss = useCallback(
    (group: MatrixGroup) => {
      dispatch({ type: "dismiss_group", id: group.id });
    },
    [dispatch],
  );

  return (
    <MatrixShell
      leftCollapsed={panelLayout.leftCollapsed}
      rightCollapsed={panelLayout.rightCollapsed}
      onToggleLeft={toggleLeftPanel}
      onToggleRight={toggleRightPanel}
      leftNav={
        <MatrixLeftNav
          groups={groups}
          historyEntries={historyEntries}
          selectedGroupId={selectedGroupId}
          selectedHistoryId={selectedHistory?.id ?? null}
          onGroupSelect={handleGroupSelect}
          onGroupAddContext={addContextForGroup}
          onGroupDismiss={handleGroupDismiss}
          onHistorySelect={handleHistorySelect}
        />
      }
      center={
        <div className="matrix-main">
          <div className="matrix-grid-wrap">
            <MatrixGrid
              document={document}
              groups={groups}
              selection={selection}
              editingGroupId={editingGroupId}
              groupLabelDraft={groupLabelDraft}
              onCellClick={handleCellClick}
              onCellEdited={handleCellEdited}
              onCellsEdited={handleCellsEdited}
              onColumnHeaderClick={handleColumnHeaderClick}
              onColumnResize={handleColumnWidthChange}
              onGroupLabelClick={handleGroupLabelClick}
              onGroupLabelDraftChange={setGroupLabelDraft}
              onGroupLabelSave={handleSaveGroupLabel}
              onGroupLabelCancel={() => {
                setEditingGroupId(null);
                setGroupLabelDraft("");
              }}
              onSelectionChange={handleSelectionChange}
            />
            <MatrixOnboarding />
          </div>

          {(editingColumn !== null || selectedColumnIndex !== null) && (
            <div className="matrix-column-label-editor" data-testid="matrix-column-label-editor">
              <span className="matrix-column-label-coordinate">
                Column {formatColumnLabel(editingColumn ?? selectedColumnIndex ?? 0)}
              </span>
              {editingColumn === null ? (
                <button
                  type="button"
                  className="matrix-secondary-button"
                  data-testid="matrix-column-label-start"
                  onClick={() =>
                    selectedColumnIndex !== null && handleStartColumnLabelEdit(selectedColumnIndex)
                  }
                >
                  Rename
                </button>
              ) : (
                <>
                  <input
                    className="matrix-column-label-input"
                    data-testid="matrix-column-label-input"
                    value={columnLabelDraft}
                    placeholder="Column label"
                    onChange={(event) => setColumnLabelDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSaveColumnLabel();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingColumn(null);
                        setColumnLabelDraft("");
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="matrix-primary-button"
                    data-testid="matrix-column-label-save"
                    onClick={handleSaveColumnLabel}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="matrix-secondary-button"
                    data-testid="matrix-column-label-clear"
                    onClick={handleClearColumnLabel}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          )}

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
