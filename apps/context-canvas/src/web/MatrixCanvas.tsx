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
  loadMatrixGroupLabelOffsets,
  saveMatrixGroupLabelOffsets,
} from "./matrix-group-label-offsets.ts";
import { loadMatrixRowHeights, saveMatrixRowHeights } from "./matrix-row-heights.ts";
import {
  appendMatrixHistory,
  createMatrixDocumentFromHistorySnapshot,
  createMatrixHistorySnapshot,
  createHistoryEntry,
  loadMatrixHistory,
  saveMatrixHistory,
  summarizePatches,
  truncatePreview,
} from "./matrix-history.ts";
import {
  createMatrixEditHistoryEntry,
  createMatrixEditHistoryState,
  pushMatrixEditHistoryEntry,
  redoMatrixEditHistory,
  undoMatrixEditHistory,
  type MatrixEditCellRef,
  type MatrixEditOperationType,
} from "./matrix-edit-history.ts";
import { scheduleMatrixBundleExport } from "./export-matrix-bundle.ts";
import {
  matrixShortcutBlockedStatus,
  matrixShortcutDirection,
  matrixUndoRedoShortcutAction,
  shouldHandleMatrixUndoRedoShortcut,
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

const CELL_REFERENCE_PROMPT =
  "Answer using only the referenced matrix context. Write the answer into this formula cell.";

interface CellReferenceFormula {
  readonly label: string;
  readonly range: RangeRefDTO;
  readonly groupId?: string;
}

function parseColumnLabel(label: string): number | null {
  if (!/^[A-Z]+$/.test(label)) {
    return null;
  }
  let col = 0;
  for (const char of label) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }
  return col - 1;
}

function parseCellAddress(address: string): { readonly row: number; readonly col: number } | null {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(address.trim().toUpperCase());
  if (!match) {
    return null;
  }
  const col = parseColumnLabel(match[1] ?? "");
  const row = Number(match[2]) - 1;
  if (col === null || !Number.isInteger(row)) {
    return null;
  }
  return { row, col };
}

function parseA1Reference(token: string, document: MatrixDocument): CellReferenceFormula | null {
  const parts = token.split(":");
  if (parts.length > 2) {
    return null;
  }
  const startToken = parts[0];
  const endToken = parts[1] ?? startToken;
  if (!startToken || !endToken) {
    return null;
  }
  const start = parseCellAddress(startToken);
  const end = parseCellAddress(endToken);
  if (!start || !end) {
    return null;
  }
  const range: RangeRefDTO = {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
  if (
    range.startRow < 0 ||
    range.startCol < 0 ||
    range.endRow >= document.sheet.rows ||
    range.endCol >= document.sheet.cols
  ) {
    return null;
  }
  return {
    label: formatRangeLabel(range.startCol, range.startRow, range.endCol, range.endRow),
    range,
  };
}

function findNamedRangeByFormulaToken(
  document: MatrixDocument,
  token: string,
): CellReferenceFormula | null {
  const normalized = token.slice(1).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  for (const named of document.namedRanges.values()) {
    if (named.name.trim().toLowerCase() === normalized) {
      return { label: `@${named.name}`, range: named.range };
    }
  }
  return null;
}

function resolveCellReferenceFormula(
  document: MatrixDocument,
  body: string,
): CellReferenceFormula | null {
  if (!body.startsWith("=") || body === "=") {
    return null;
  }
  const token = body.slice(1).trim();
  if (!token) {
    return null;
  }

  const a1Reference = parseA1Reference(token, document);
  if (a1Reference) {
    return a1Reference;
  }

  if (token.startsWith("@")) {
    return findNamedRangeByFormulaToken(document, token);
  }

  const matchingGroups = [...document.groups.values()].filter(
    (group) => !group.dismissed && group.label.trim() === token,
  );
  if (matchingGroups.length !== 1) {
    return null;
  }
  const [group] = matchingGroups;
  return { label: group.label, range: group.range, groupId: group.id };
}

function nextChipId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ReferenceEditState {
  readonly row: number;
  readonly col: number;
}

interface RestoreSourceState {
  readonly document: MatrixDocument;
  readonly selection: MatrixGridSelectionState | null;
  readonly contextChips: readonly ContextChip[];
  readonly targetRange: RangeRefDTO | null;
}

interface MatrixInlineEditShortcut {
  readonly direction: MatrixTargetDirection;
  readonly selectionRange: RangeRefDTO | null;
  readonly selectionLabel?: string | null;
  readonly prompt?: string;
}

function rangeRefToSelection(range: RangeRefDTO): MatrixGridSelectionState {
  return {
    startRow: range.startRow,
    startCol: range.startCol,
    endRow: range.endRow,
    endCol: range.endCol,
    activeRow: range.startRow,
    activeCol: range.startCol,
  };
}

export function MatrixCanvas(): ReactElement {
  const [document, setDocument] = useState<MatrixDocument>(() => {
    const storedWidths = loadMatrixColumnWidths();
    const storedHeights = loadMatrixRowHeights();
    const base = createEmptyMatrixDocument();
    if (storedWidths.size === 0 && storedHeights.size === 0) {
      return base;
    }
    return {
      ...base,
      ...(storedWidths.size > 0 ? { columnWidths: storedWidths } : {}),
      ...(storedHeights.size > 0 ? { rowHeights: storedHeights } : {}),
    };
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
  const [referenceEdit, setReferenceEdit] = useState<ReferenceEditState | null>(null);
  const [panelLayout, setPanelLayout] = useState(() => loadMatrixPanelLayout());
  const [leftPanelPeeked, setLeftPanelPeeked] = useState(false);
  const [rightPanelPeeked, setRightPanelPeeked] = useState(false);

  const [historyEntries, setHistoryEntries] = useState<MatrixHistoryEntry[]>(() => loadMatrixHistory());
  const [selectedHistory, setSelectedHistory] = useState<MatrixHistoryEntry | null>(null);
  const [restoredHistoryId, setRestoredHistoryId] = useState<string | null>(null);
  const restoreSourceRef = useRef<RestoreSourceState | null>(null);
  const historyEntriesRef = useRef(historyEntries);
  const editHistoryRef = useRef(createMatrixEditHistoryState());
  const storedGroupLabelOffsetsRef = useRef(loadMatrixGroupLabelOffsets());
  const activeMatrixRunsRef = useRef(0);

  const groups = useMemo(() => visibleMatrixGroups(document), [document]);

  useEffect(() => {
    historyEntriesRef.current = historyEntries;
    saveMatrixHistory(historyEntries);
  }, [historyEntries]);

  const restoreCurrentDocumentFromPreview = useCallback(
    (options: { readonly closeHistory?: boolean; readonly status?: string } = {}) => {
      const source = restoreSourceRef.current;
      if (!source) {
        return false;
      }
      restoreSourceRef.current = null;
      docRef.current = source.document;
      setDocument(source.document);
      setSelection(source.selection);
      setContextChips([...source.contextChips]);
      setTargetRange(source.targetRange);
      setRestoredHistoryId(null);
      if (options.closeHistory !== false) {
        setSelectedHistory(null);
      }
      if (options.status) {
        setStatus(options.status);
      }
      return true;
    },
    [],
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

  const dispatchRecorded = useCallback(
    (
      command: MatrixCommand,
      options: {
        readonly operationType: MatrixEditOperationType;
        readonly label: string;
        readonly affectedCells: readonly MatrixEditCellRef[];
      },
    ) => {
      restoreCurrentDocumentFromPreview();
      const beforeDocument = docRef.current;
      const result = applyMatrixCommand(beforeDocument, command);
      docRef.current = result.document;
      setDocument(result.document);
      const entry = createMatrixEditHistoryEntry({
        operationType: options.operationType,
        label: options.label,
        beforeDocument,
        afterDocument: result.document,
        affectedCells: options.affectedCells,
      });
      editHistoryRef.current = pushMatrixEditHistoryEntry(editHistoryRef.current, entry);
      if (result.meta.message) {
        setStatus(result.meta.message);
      }
      return result;
    },
    [restoreCurrentDocumentFromPreview],
  );

  const dispatchRecordedBatch = useCallback(
    (
      commands: readonly MatrixCommand[],
      options: {
        readonly operationType: MatrixEditOperationType;
        readonly label: string;
        readonly affectedCells: readonly MatrixEditCellRef[];
        readonly status?: string;
      },
    ) => {
      restoreCurrentDocumentFromPreview();
      const beforeDocument = docRef.current;
      let current = beforeDocument;
      let lastResult: ReturnType<typeof applyMatrixCommand> = {
        document: current,
        meta: { updatedCells: 0 },
      };
      for (const command of commands) {
        lastResult = applyMatrixCommand(current, command);
        current = lastResult.document;
      }
      docRef.current = current;
      setDocument(current);
      const entry = createMatrixEditHistoryEntry({
        operationType: options.operationType,
        label: options.label,
        beforeDocument,
        afterDocument: current,
        affectedCells: options.affectedCells,
      });
      editHistoryRef.current = pushMatrixEditHistoryEntry(editHistoryRef.current, entry);
      if (options.status) {
        setStatus(options.status);
      } else if (lastResult.meta.message) {
        setStatus(lastResult.meta.message);
      }
      return lastResult;
    },
    [restoreCurrentDocumentFromPreview],
  );

  const applyEditHistoryAction = useCallback(
    (action: "undo" | "redo") => {
      if (activeMatrixRunsRef.current > 0) {
        setStatus("Wait for matrix run to finish before undo");
        return;
      }
      restoreCurrentDocumentFromPreview();
      const result =
        action === "undo"
          ? undoMatrixEditHistory(docRef.current, editHistoryRef.current)
          : redoMatrixEditHistory(docRef.current, editHistoryRef.current);
      editHistoryRef.current = result.state;
      if (!result.entry) {
        setStatus(action === "undo" ? "Nothing to undo" : "Nothing to redo");
        return;
      }
      docRef.current = result.document;
      setDocument(result.document);
      setSelectedHistory(null);
      setRestoredHistoryId(null);
      if (selection) {
        const activeCell = result.document.sheet.cells.get(
          cellKey(selection.activeRow, selection.activeCol),
        );
        setDetailCell({
          row: selection.activeRow,
          col: selection.activeCol,
          body: activeCell?.body ?? "",
        });
        setDetailFrontmatter(activeCell?.frontmatter ?? "");
      } else if (result.entry.operationType === "cells.edit" || result.entry.operationType === "ai.apply") {
        setDetailCell(null);
        setDetailFrontmatter("");
      }
      saveMatrixGroupLabelOffsets(result.document.groups);
      storedGroupLabelOffsetsRef.current = new Map(
        [...result.document.groups.entries()]
          .filter((entry): entry is [string, MatrixGroup & { readonly labelOffset: NonNullable<MatrixGroup["labelOffset"]> }] =>
            Boolean(entry[1].labelOffset),
          )
          .map(([id, storedGroup]) => [id, storedGroup.labelOffset]),
      );
      scheduleMatrixBundleExport(result.document, historyEntriesRef.current);
      setStatus(`${action === "undo" ? "Undo" : "Redo"}: ${result.entry.label}`);
    },
    [restoreCurrentDocumentFromPreview, selection],
  );

  const beginMatrixRun = useCallback(() => {
    activeMatrixRunsRef.current += 1;
    setIsRunning(true);
  }, []);

  const finishMatrixRun = useCallback(() => {
    activeMatrixRunsRef.current = Math.max(0, activeMatrixRunsRef.current - 1);
    if (activeMatrixRunsRef.current === 0) {
      setIsRunning(false);
    }
  }, []);

  const runCellReferenceFormula = useCallback(
    async (
      row: number,
      col: number,
      body: string,
      reference: CellReferenceFormula,
      contextDocument: MatrixDocument,
    ) => {
      const target: RangeRefDTO = { startRow: row, startCol: col, endRow: row, endCol: col };
      const targetLabel = rangeLabelForSelection(contextDocument, target);
      const formulaCellKey = cellKey(row, col);
      const formulaBody = body;
      beginMatrixRun();
      setStatus(`Running cell reference: ${reference.label}`);
      try {
        const contextRanges: MatrixContextRange[] = [
          { label: reference.label, range: reference.range, groupId: reference.groupId },
        ];
        const compiled = compileMatrixRangeContext(
          contextDocument,
          contextRanges,
          target,
          CELL_REFERENCE_PROMPT,
        );
        const response = await runMatrix({
          prompt: CELL_REFERENCE_PROMPT,
          targetRange: target,
          compiled,
        });

        const parsed = parseAiCommand(response.command);
        if (!parsed.ok) {
          setStatus(`Cell reference validation failed: ${parsed.errors.message}`);
          return;
        }

        const currentBody = docRef.current.sheet.cells.get(formulaCellKey)?.body ?? "";
        if (currentBody !== formulaBody) {
          // INVARIANT: an async reference run must not overwrite a later user edit.
          setStatus("Cell reference skipped: formula cell changed");
          return;
        }

        const { command: boundCommand, strippedCount } = bindAiCommandToUserTarget(
          parsed.command,
          target,
        );
        const result = dispatchRecorded(
          { type: "apply_ai_command", command: boundCommand },
          {
            operationType: "ai.apply",
            label: "Cell reference applied",
            affectedCells: boundCommand.patches.map((patch) => ({ row: patch.row, col: patch.col })),
          },
        );

        const historyEntry = createHistoryEntry({
          intent: CELL_REFERENCE_PROMPT,
          contextRanges,
          targetRange: target,
          targetRangeLabel: targetLabel ?? compiled.targetRangeLabel,
          patchesApplied: result.meta.updatedCells,
          compiledContextPreview: truncatePreview(compiled.contextText),
          patchesSummary: summarizePatches(boundCommand),
          snapshot: createMatrixHistorySnapshot(result.document),
        });
        const nextHistory = appendMatrixHistory(historyEntriesRef.current, historyEntry);
        historyEntriesRef.current = nextHistory;
        setHistoryEntries(nextHistory);
        scheduleMatrixBundleExport(docRef.current, nextHistory);
        setDetailCell(null);
        setDetailFrontmatter("");
        setSelectedHistory(historyEntry);

        let message = `Cell reference applied: ${result.meta.updatedCells} cells updated`;
        if (strippedCount > 0) {
          message += ` — ${strippedCount} patch(es) outside target range skipped`;
        }
        setStatus(message);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Cell reference failed: ${message}`);
      } finally {
        finishMatrixRun();
      }
    },
    [beginMatrixRun, dispatchRecorded, finishMatrixRun],
  );

  const groupOffsetRestoreKey = useMemo(
    () =>
      groups
        .map((group) => `${group.id}:${group.labelOffset?.x ?? ""}:${group.labelOffset?.y ?? ""}`)
        .join("|"),
    [groups],
  );

  useEffect(() => {
    for (const group of groups) {
      const storedOffset = storedGroupLabelOffsetsRef.current.get(group.id);
      if (
        storedOffset &&
        (group.labelOffset?.x !== storedOffset.x || group.labelOffset?.y !== storedOffset.y)
      ) {
        dispatch({ type: "set_group_label_offset", id: group.id, offset: storedOffset });
      }
    }
  }, [dispatch, groupOffsetRestoreKey]);

  const syncDetailFromActiveCell = useCallback(
    (row: number, col: number) => {
      restoreCurrentDocumentFromPreview();
      setSelectedHistory(null);
      const key = cellKey(row, col);
      const domainCell = docRef.current.sheet.cells.get(key);
      setDetailCell({
        row,
        col,
        body: domainCell?.body ?? "",
      });
      setDetailFrontmatter(domainCell?.frontmatter ?? "");
    },
    [restoreCurrentDocumentFromPreview],
  );

  const insertReferenceToken = useCallback(
    (token: string, referenceOverride?: CellReferenceFormula) => {
      if (!referenceEdit || token.length === 0) {
        return false;
      }
      const body = `=${token}`;
      const contextDocument = docRef.current;
      const originFrontmatter =
        docRef.current.sheet.cells.get(cellKey(referenceEdit.row, referenceEdit.col))?.frontmatter ?? "";
      dispatchRecorded(
        { type: "update_cell_body", row: referenceEdit.row, col: referenceEdit.col, body },
        {
          operationType: "cells.edit",
          label: `Cell ${formatColumnLabel(referenceEdit.col)}${referenceEdit.row + 1} updated`,
          affectedCells: [{ row: referenceEdit.row, col: referenceEdit.col }],
        },
      );
      setDetailCell({ row: referenceEdit.row, col: referenceEdit.col, body });
      setDetailFrontmatter(originFrontmatter);
      setReferenceEdit(null);
      setStatus(`Reference inserted: ${token}`);
      const reference = referenceOverride ?? resolveCellReferenceFormula(contextDocument, body);
      if (reference) {
        void runCellReferenceFormula(
          referenceEdit.row,
          referenceEdit.col,
          body,
          reference,
          contextDocument,
        );
      }
      return true;
    },
    [dispatchRecorded, referenceEdit, runCellReferenceFormula],
  );

  const handleSelectionChange = useCallback(
    (next: MatrixGridSelectionState | null) => {
      setSelection(next);
      if (referenceEdit && !next) {
        setReferenceEdit(null);
        setStatus("Reference edit cancelled");
        return;
      }
      if (referenceEdit && next) {
        const pickedRange = selectionToRangeRef(next);
        // INVARIANT: entering reference mode should not immediately rewrite the origin cell
        // if Glide replays the current single-cell selection.
        const isSameOrigin =
          pickedRange.startRow === referenceEdit.row &&
          pickedRange.endRow === referenceEdit.row &&
          pickedRange.startCol === referenceEdit.col &&
          pickedRange.endCol === referenceEdit.col;
        if (!isSameOrigin) {
          insertReferenceToken(
            formatRangeLabel(
              pickedRange.startCol,
              pickedRange.startRow,
              pickedRange.endCol,
              pickedRange.endRow,
            ),
          );
        }
        return;
      }
      if (next) {
        syncDetailFromActiveCell(next.activeRow, next.activeCol);
      }
    },
    [insertReferenceToken, referenceEdit, syncDetailFromActiveCell],
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

  const showAiSection = true;

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
    setLeftPanelPeeked(false);
    setPanelLayout((current) => {
      const next = { ...current, leftCollapsed: !current.leftCollapsed };
      saveMatrixPanelLayout(next);
      return next;
    });
  }, []);

  const toggleRightPanel = useCallback(() => {
    setRightPanelPeeked(false);
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
        { id: nextChipId(), label: group.label, range: group.range, groupId: group.id },
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
      restoreCurrentDocumentFromPreview();
      setEditingColumn(col);
      setColumnLabelDraft(getColumnCustomLabel(docRef.current, col));
      setStatus(`Editing column ${formatColumnLabel(col)} label`);
    },
    [restoreCurrentDocumentFromPreview],
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
    restoreCurrentDocumentFromPreview();
    dispatch({
      type: "set_column_custom_label",
      col: editingColumn,
      label: columnLabelDraft,
    });
    setEditingColumn(null);
    setColumnLabelDraft("");
  }, [columnLabelDraft, dispatch, editingColumn, restoreCurrentDocumentFromPreview]);

  const handleStartGroupLabelEdit = useCallback((group: MatrixGroup) => {
    setEditingGroupId(group.id);
    setGroupLabelDraft(group.label);
    setStatus(`Editing group label: ${group.label}`);
  }, []);

  const handleSaveGroupLabel = useCallback(() => {
    if (!editingGroupId) {
      return;
    }
    dispatchRecorded(
      {
        type: "set_group_label",
        id: editingGroupId,
        label: groupLabelDraft,
      },
      {
        operationType: "group.rename",
        label: "Group label renamed",
        affectedCells: [],
      },
    );
    setEditingGroupId(null);
    setGroupLabelDraft("");
  }, [dispatchRecorded, editingGroupId, groupLabelDraft]);

  const handleClearColumnLabel = useCallback(() => {
    if (editingColumn === null) {
      return;
    }
    restoreCurrentDocumentFromPreview();
    dispatch({
      type: "set_column_custom_label",
      col: editingColumn,
      label: "",
    });
    setEditingColumn(null);
    setColumnLabelDraft("");
  }, [dispatch, editingColumn, restoreCurrentDocumentFromPreview]);

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
    restoreCurrentDocumentFromPreview();
    dispatch({
      type: "set_named_range",
      namedRange: { name, range: selectionRange },
    });
    setRangeNameInput("");
  }, [dispatch, rangeNameInput, restoreCurrentDocumentFromPreview, selectionLabel, selectionRange]);

  const runWithTarget = useCallback(
    async (
      runTargetRange: RangeRefDTO,
      runContextChips: readonly ContextChip[],
      runPrompt = prompt.trim(),
    ) => {
      const trimmedPrompt = runPrompt.trim();
      if (!trimmedPrompt) {
        setStatus("Enter a prompt before running");
        return;
      }

      const runTargetLabel = rangeLabelForSelection(docRef.current, runTargetRange);
      beginMatrixRun();
      setStatus("Running matrix AI...");
      try {
        const contextRanges: MatrixContextRange[] = runContextChips.map((chip) => ({
          label: chip.label,
          range: chip.range,
          groupId: chip.groupId,
        }));

        const compiled = compileMatrixRangeContext(
          docRef.current,
          contextRanges,
          runTargetRange,
          trimmedPrompt,
        );
        const response = await runMatrix({
          prompt: trimmedPrompt,
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
        const result = dispatchRecorded(
          { type: "apply_ai_command", command: boundCommand },
          {
            operationType: "ai.apply",
            label: "AI result applied",
            affectedCells: boundCommand.patches.map((patch) => ({ row: patch.row, col: patch.col })),
          },
        );

        const historyEntry = createHistoryEntry({
          intent: trimmedPrompt,
          contextRanges: runContextChips.map((chip) => ({
            label: chip.label,
            range: chip.range,
            groupId: chip.groupId,
          })),
          targetRange: runTargetRange,
          targetRangeLabel: runTargetLabel ?? compiled.targetRangeLabel,
          patchesApplied: result.meta.updatedCells,
          compiledContextPreview: truncatePreview(compiled.contextText),
          patchesSummary: summarizePatches(boundCommand),
          snapshot: createMatrixHistorySnapshot(result.document),
        });
        const nextHistory = appendMatrixHistory(historyEntriesRef.current, historyEntry);
        historyEntriesRef.current = nextHistory;
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
        finishMatrixRun();
      }
    },
    [beginMatrixRun, dispatchRecorded, finishMatrixRun, prompt],
  );

  const handleRun = useCallback(async () => {
    const runTarget = targetRange ?? selectionRange;
    if (!runTarget) {
      setStatus("Select a range before running");
      return;
    }
    if (!prompt.trim()) {
      setStatus("Enter a prompt before running");
      return;
    }
    if (!targetRange) {
      setTargetRange(runTarget);
    }
    await runWithTarget(runTarget, contextChips);
  }, [contextChips, prompt, runWithTarget, selectionRange, targetRange]);

  const contextChipsWithSelection = useCallback(
    (
      baseChips: readonly ContextChip[],
      selectionRangeOverride: RangeRefDTO | null = selectionRange,
      selectionLabelOverride: string | null = selectionLabel,
    ): { readonly chips: readonly ContextChip[]; readonly added: boolean } => {
      if (!selectionRangeOverride || !selectionLabelOverride) {
        return { chips: baseChips, added: false };
      }
      const duplicate = baseChips.some((chip) => rangesEqual(chip.range, selectionRangeOverride));
      if (duplicate) {
        return { chips: baseChips, added: false };
      }
      return {
        chips: [
          ...baseChips,
          { id: nextChipId(), label: selectionLabelOverride, range: selectionRangeOverride },
        ],
        added: true,
      };
    },
    [selectionLabel, selectionRange],
  );

  const runMatrixShortcut = useCallback(
    (shortcut: MatrixInlineEditShortcut) => {
      if (isRunning) {
        return;
      }
      const trimmedPrompt = prompt.trim() || shortcut.prompt?.trim() || "";
      if (!trimmedPrompt) {
        setStatus("Enter a prompt before running");
        return;
      }
      const activeSelectionRange = shortcut.selectionRange ?? selectionRange;
      const activeSelectionLabel =
        shortcut.selectionLabel ??
        selectionLabel ??
        (activeSelectionRange
          ? rangeLabelForSelection(docRef.current, activeSelectionRange)
          : null);
      if (targetRange) {
        if (shortcut.direction === "right") {
          setStatus("Target already set");
          return;
        }
        void runWithTarget(targetRange, contextChips, trimmedPrompt);
        return;
      }
      if (!activeSelectionRange || !activeSelectionLabel) {
        setStatus("Select a range before running");
        return;
      }

      const inferred = inferMatrixTargetRange(activeSelectionRange, shortcut.direction, {
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

      const nextContext = contextChipsWithSelection(
        contextChips,
        activeSelectionRange,
        activeSelectionLabel,
      );
      if (nextContext.added) {
        setContextChips([...nextContext.chips]);
      }
      setTargetRange(inferred.targetRange);
      void runWithTarget(inferred.targetRange, nextContext.chips, trimmedPrompt);
    },
    [
      contextChips,
      contextChipsWithSelection,
      isRunning,
      runWithTarget,
      selectionLabel,
      selectionRange,
      targetRange,
    ],
  );

  const handleMatrixShortcutRun = useCallback(
    (direction: MatrixTargetDirection, promptOverride?: string) => {
      runMatrixShortcut({
        direction,
        selectionRange,
        selectionLabel,
        prompt: promptOverride ?? prompt,
      });
    },
    [prompt, runMatrixShortcut, selectionLabel, selectionRange],
  );
  const handleMatrixShortcutRunRef = useRef(handleMatrixShortcutRun);
  handleMatrixShortcutRunRef.current = handleMatrixShortcutRun;
  const runMatrixShortcutRef = useRef(runMatrixShortcut);
  runMatrixShortcutRef.current = runMatrixShortcut;
  const setStatusRef = useRef(setStatus);
  setStatusRef.current = setStatus;

  useEffect(() => {
    const onCommitRun = (event: Event) => {
      const customEvent = event as CustomEvent<MatrixInlineEditShortcut>;
      if (!customEvent.detail) {
        return;
      }
      runMatrixShortcutRef.current(customEvent.detail);
    };
    window.document.addEventListener("matrix-commit-run", onCommitRun);
    return () => window.document.removeEventListener("matrix-commit-run", onCommitRun);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      const undoRedoAction = matrixUndoRedoShortcutAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        isComposing: event.isComposing,
      });
      if (undoRedoAction) {
        if (shouldHandleMatrixUndoRedoShortcut(event.target)) {
          event.preventDefault();
          applyEditHistoryAction(undoRedoAction);
        }
        return;
      }
      if (event.isComposing) {
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
  }, [applyEditHistoryAction]);

  const handleDetailSave = useCallback(
    (row: number, col: number, body: string, frontmatter: string) => {
      dispatchRecordedBatch(
        [
          { type: "update_cell_body", row, col, body },
          { type: "update_cell_frontmatter", row, col, frontmatter },
        ],
        {
          operationType: "cells.edit",
          label: `Cell ${formatColumnLabel(col)}${row + 1} updated`,
          affectedCells: [{ row, col }],
          status: `Cell ${formatColumnLabel(col)}${row + 1} updated`,
        },
      );
      setDetailCell({ row, col, body });
      setDetailFrontmatter(frontmatter);
    },
    [dispatchRecordedBatch],
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
      restoreCurrentDocumentFromPreview();
      const contextDocument = docRef.current;
      const reference = resolveCellReferenceFormula(contextDocument, body);
      dispatchRecorded(
        { type: "update_cell_body", row, col, body },
        {
          operationType: "cells.edit",
          label: `Cell ${formatColumnLabel(col)}${row + 1} updated`,
          affectedCells: [{ row, col }],
        },
      );
      setDetailCell({ row, col, body });
      const label = `${formatColumnLabel(col)}${row + 1}`;
      // CONTRACT: only a bare "=" opens #103 reference picking; typed formulas execute in #104.
      if (body === "=") {
        setReferenceEdit({ row, col });
        setStatus("Reference edit mode: select a range or group label");
        return;
      }
      if (referenceEdit) {
        setReferenceEdit(null);
      }
      if (reference) {
        void runCellReferenceFormula(row, col, body, reference, contextDocument);
        return;
      }
      setStatus(`Cell ${label} updated`);
    },
    [dispatchRecorded, referenceEdit, restoreCurrentDocumentFromPreview, runCellReferenceFormula],
  );

  const handleCellsEdited = useCallback(
    (edits: readonly MatrixCellEdit[]) => {
      if (edits.length === 0) {
        return;
      }

      restoreCurrentDocumentFromPreview();
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
      dispatchRecorded(
        { type: "apply_patches", patches },
        {
          operationType: "cells.edit",
          label: edits.length === 1 ? "Cell updated" : `${edits.length} cells updated`,
          affectedCells: edits.map((edit) => ({ row: edit.row, col: edit.col })),
        },
      );
      if (referenceEdit) {
        setReferenceEdit(null);
      }

      const activeEdit = selection
        ? edits.find((edit) => edit.row === selection.activeRow && edit.col === selection.activeCol)
        : undefined;
      const detailEdit = activeEdit ?? edits[0];
      setDetailCell({ row: detailEdit.row, col: detailEdit.col, body: detailEdit.body });
      const label = `${formatColumnLabel(detailEdit.col)}${detailEdit.row + 1}`;
      setStatus(edits.length === 1 ? `Cell ${label} updated` : `${edits.length} cells updated`);
    },
    [dispatchRecorded, referenceEdit, restoreCurrentDocumentFromPreview, selection],
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

  const handleHistorySelect = useCallback(
    (entry: MatrixHistoryEntry) => {
      setSelectedHistory(entry);
      setDetailCell(null);
      setDetailFrontmatter("");

      if (!entry.snapshot || entry.snapshot.truncated) {
        // INVARIANT: a non-restorable entry must not leave the grid showing a previous preview.
        restoreCurrentDocumentFromPreview({ closeHistory: false });
        setStatus(
          !entry.snapshot
            ? "History entry has no document snapshot"
            : "History snapshot is truncated and cannot restore full cells",
        );
        return;
      }

      if (!restoreSourceRef.current) {
        restoreSourceRef.current = {
          document: docRef.current,
          selection,
          contextChips,
          targetRange,
        };
      }

      const restoredDocument = createMatrixDocumentFromHistorySnapshot(entry.snapshot, docRef.current);
      docRef.current = restoredDocument;
      setDocument(restoredDocument);
      if (entry.targetRange) {
        setSelection(rangeRefToSelection(entry.targetRange));
      }
      setRestoredHistoryId(entry.id);
      setStatus(`Restored history snapshot: ${entry.targetRangeLabel}`);
    },
    [contextChips, restoreCurrentDocumentFromPreview, selection, targetRange],
  );

  const handleHistoryClose = useCallback(() => {
    setSelectedHistory(null);
  }, []);

  const handleReturnToCurrentDocument = useCallback(() => {
    if (
      !restoreCurrentDocumentFromPreview({
        status: "Returned to current document",
      })
    ) {
      setSelectedHistory(null);
      setRestoredHistoryId(null);
    }
  }, [restoreCurrentDocumentFromPreview]);

  const handleHistoryRerun = useCallback(
    (entry: MatrixHistoryEntry) => {
      restoreCurrentDocumentFromPreview();
      setPrompt(entry.intent);
      setContextChips(
        entry.contextRanges.map((range) => ({
          id: nextChipId(),
          label: range.label,
          range: range.range,
          groupId: range.groupId,
        })),
      );
      setTargetRange(entry.targetRange);
      setSelectedHistory(null);
      setStatus("Composer pre-filled from history — review and Run");
    },
    [restoreCurrentDocumentFromPreview],
  );

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
      const label = group.label.trim();
      if (
        !options.isDoubleClick &&
        insertReferenceToken(label, { label, range: group.range, groupId: group.id })
      ) {
        return;
      }
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
    [editingGroupId, handleGroupSelect, handleStartGroupLabelEdit, insertReferenceToken],
  );

  const handleColumnWidthChange = useCallback(
    (col: number, width: number) => {
      restoreCurrentDocumentFromPreview();
      const result = dispatch({ type: "set_column_width", col, width });
      saveMatrixColumnWidths(result.document.columnWidths);
      scheduleMatrixBundleExport(result.document, historyEntries);
    },
    [dispatch, historyEntries, restoreCurrentDocumentFromPreview],
  );

  const handleRowHeightChange = useCallback(
    (row: number, height: number) => {
      restoreCurrentDocumentFromPreview();
      const result = dispatch({ type: "set_row_height", row, height });
      saveMatrixRowHeights(result.document.rowHeights);
      scheduleMatrixBundleExport(result.document, historyEntries);
    },
    [dispatch, historyEntries, restoreCurrentDocumentFromPreview],
  );

  const handleGroupLabelOffsetChange = useCallback(
    (group: MatrixGroup, offset: { readonly x: number; readonly y: number }) => {
      const result = dispatchRecorded(
        { type: "set_group_label_offset", id: group.id, offset },
        {
          operationType: "group.move",
          label: `Group label moved: ${group.label}`,
          affectedCells: [],
        },
      );
      saveMatrixGroupLabelOffsets(result.document.groups);
      storedGroupLabelOffsetsRef.current = new Map(
        [...result.document.groups.entries()]
          .filter((entry): entry is [string, MatrixGroup & { readonly labelOffset: NonNullable<MatrixGroup["labelOffset"]> }] =>
            Boolean(entry[1].labelOffset),
          )
          .map(([id, storedGroup]) => [id, storedGroup.labelOffset]),
      );
      scheduleMatrixBundleExport(result.document, historyEntries);
    },
    [dispatchRecorded, historyEntries],
  );

  const handleGroupDismiss = useCallback(
    (group: MatrixGroup) => {
      const result = dispatchRecorded(
        { type: "dismiss_group", id: group.id },
        {
          operationType: "group.dismiss",
          label: `Group hidden: ${group.label}`,
          affectedCells: [],
        },
      );
      saveMatrixGroupLabelOffsets(result.document.groups);
      const nextStoredOffsets = new Map(storedGroupLabelOffsetsRef.current);
      nextStoredOffsets.delete(group.id);
      storedGroupLabelOffsetsRef.current = nextStoredOffsets;
    },
    [dispatchRecorded],
  );

  return (
    <MatrixShell
      leftCollapsed={panelLayout.leftCollapsed}
      rightCollapsed={panelLayout.rightCollapsed}
      leftPeeked={leftPanelPeeked}
      rightPeeked={rightPanelPeeked}
      onToggleLeft={toggleLeftPanel}
      onToggleRight={toggleRightPanel}
      onLeftPeekChange={setLeftPanelPeeked}
      onRightPeekChange={setRightPanelPeeked}
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
              onRowResize={handleRowHeightChange}
              onGroupLabelClick={handleGroupLabelClick}
              onGroupLabelOffsetChange={handleGroupLabelOffsetChange}
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
            canRun={Boolean(targetRange ?? selectionRange) && prompt.trim().length > 0}
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
            isRestored={restoredHistoryId !== null}
            onClose={restoredHistoryId !== null ? handleReturnToCurrentDocument : handleHistoryClose}
            onRerun={handleHistoryRerun}
            onReturnToCurrent={handleReturnToCurrentDocument}
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
