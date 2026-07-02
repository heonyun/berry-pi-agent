import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { flushSync } from "react-dom";
import {
  DataEditor,
  GridCellKind,
  type DataEditorProps,
  type DataEditorRef,
  type EditableGridCell,
  type EditListItem,
  type GridColumn,
  type HeaderClickedEventArgs,
  type GridSelection,
  type Item,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { getColumnHeader, type MatrixDocument, type MatrixGroup } from "../shared/domain.ts";
import {
  getCellContent,
  getMatrixGridConfig,
  getMatrixGridTheme,
} from "../adapters/matrix-glide.ts";
import {
  clearedGridSelection,
  gridSelectionToMatrixSelection,
  rangeRefToGridSelection,
  type MatrixGridSelectionState,
} from "../adapters/matrix-grid-selection.ts";

export type { MatrixGridSelectionState };

export interface MatrixCellEdit {
  readonly row: number;
  readonly col: number;
  readonly body: string;
}

export interface MatrixGridProps {
  readonly document: MatrixDocument;
  readonly groups: readonly MatrixGroup[];
  readonly selection: MatrixGridSelectionState | null;
  readonly editingGroupId: string | null;
  readonly groupLabelDraft: string;
  readonly onCellClick: (row: number, col: number) => void;
  readonly onCellEdited: (row: number, col: number, body: string) => void;
  readonly onCellsEdited: (edits: readonly MatrixCellEdit[]) => void;
  readonly onColumnHeaderClick?: (
    col: number,
    options: { readonly isDoubleClick: boolean },
  ) => void;
  readonly onGroupLabelDraftChange: (label: string) => void;
  readonly onGroupLabelEditStart: (group: MatrixGroup) => void;
  readonly onGroupLabelSave: () => void;
  readonly onGroupLabelCancel: () => void;
  readonly onSelectionChange: (selection: MatrixGridSelectionState | null) => void;
}

interface GroupLabelPosition {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly maxWidth: number;
}

function matrixSelectionToGridSelection(selection: MatrixGridSelectionState | null): GridSelection {
  if (!selection) {
    return clearedGridSelection();
  }
  return rangeRefToGridSelection(selection, {
    col: selection.activeCol,
    row: selection.activeRow,
  });
}

export function MatrixGrid({
  document,
  groups,
  selection,
  editingGroupId,
  groupLabelDraft,
  onCellClick,
  onCellEdited,
  onCellsEdited,
  onColumnHeaderClick = () => {},
  onGroupLabelDraftChange,
  onGroupLabelEditStart,
  onGroupLabelSave,
  onGroupLabelCancel,
  onSelectionChange,
}: MatrixGridProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<DataEditorRef | null>(null);
  const config = useMemo(() => getMatrixGridConfig(document), [document]);
  const theme = useMemo(() => getMatrixGridTheme(), []);
  const [groupLabelPositions, setGroupLabelPositions] = useState<readonly GroupLabelPosition[]>([]);
  const skipNextGroupLabelBlurSave = useRef(false);

  const columns = useMemo(
    () =>
      Array.from({ length: config.cols }, (_, i) => ({
        id: String(i),
        title: getColumnHeader(document, i),
        width: 120,
      })) as readonly GridColumn[],
    [config.cols, document],
  );

  const cellContent = useMemo(() => getCellContent(document), [document]);

  const groupHighlights = useMemo<DataEditorProps["highlightRegions"]>(
    () =>
      groups.map((group) => ({
        color: "rgba(86, 114, 151, 0.14)",
        style: "solid-outline",
        range: {
          x: group.range.startCol,
          y: group.range.startRow,
          width: group.range.endCol - group.range.startCol + 1,
          height: group.range.endRow - group.range.startRow + 1,
        },
      })),
    [groups],
  );

  const updateGroupLabelPositions = useCallback(() => {
    const container = containerRef.current;
    const grid = gridRef.current;
    if (!container || !grid) {
      setGroupLabelPositions([]);
      return;
    }
    const containerBounds = container.getBoundingClientRect();
    const nextPositions: GroupLabelPosition[] = [];
    for (const group of groups) {
      const bounds = grid.getBounds(group.range.startCol, group.range.startRow);
      if (!bounds) {
        continue;
      }
      // CONTRACT: Glide DataEditorRef.getBounds returns viewport coordinates; subtract the
      // container viewport rect to place labels in this absolute overlay layer.
      const left = Math.max(4, bounds.x - containerBounds.x + 4);
      const top = Math.max(2, bounds.y - containerBounds.y - 12);
      const maxWidth = Math.max(72, Math.min(190, bounds.width + 88));
      if (
        left > containerBounds.width ||
        top > containerBounds.height ||
        bounds.x + bounds.width < containerBounds.x ||
        bounds.y + bounds.height < containerBounds.y
      ) {
        continue;
      }
      nextPositions.push({ id: group.id, left, top, maxWidth });
    }
    setGroupLabelPositions(nextPositions);
  }, [groups]);

  const [gridSelection, setGridSelection] = useState<GridSelection>(() =>
    matrixSelectionToGridSelection(selection),
  );

  const externalSelectionKey = useMemo(() => {
    if (!selection) {
      return "";
    }
    const { startCol, startRow, endCol, endRow, activeCol, activeRow } = selection;
    return `${startCol}:${startRow}:${endCol}:${endRow}:${activeCol}:${activeRow}`;
  }, [selection]);

  const lastExternalSelectionKey = useRef(externalSelectionKey);

  useEffect(() => {
    if (lastExternalSelectionKey.current === externalSelectionKey) {
      return;
    }
    lastExternalSelectionKey.current = externalSelectionKey;
    if (!selection) {
      setGridSelection(clearedGridSelection());
      return;
    }
    setGridSelection(matrixSelectionToGridSelection(selection));
  }, [externalSelectionKey, selection]);

  useLayoutEffect(() => {
    updateGroupLabelPositions();
  }, [updateGroupLabelPositions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    // RISK: Panel collapse/expand resizes the canvas without a Glide visible-region event.
    const observer = new ResizeObserver(() => updateGroupLabelPositions());
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateGroupLabelPositions]);

  const handleGridSelectionChange = useCallback(
    (newSelection: GridSelection) => {
      // WHY: Glide defers controlled selection when onGridSelectionChange is set;
      // local flushSync keeps gridSelection.current available for editOnType/activation.
      flushSync(() => {
        setGridSelection(newSelection);
        onSelectionChange(gridSelectionToMatrixSelection(newSelection, config));
      });
    },
    [config, onSelectionChange],
  );

  const handleCellClicked = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) {
        return;
      }
      onCellClick(row, col);
    },
    [config.cols, config.rows, onCellClick],
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (newValue.kind !== GridCellKind.Text) {
        return;
      }
      const [col, row] = cell;
      if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) {
        return;
      }
      onCellEdited(row, col, newValue.data);
    },
    [config.cols, config.rows, onCellEdited],
  );

  const handleCellsEdited = useCallback(
    (items: readonly EditListItem[]) => {
      const edits: MatrixCellEdit[] = [];
      for (const item of items) {
        if (item.value.kind !== GridCellKind.Text) {
          continue;
        }
        const [col, row] = item.location;
        if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) {
          continue;
        }
        edits.push({ row, col, body: item.value.data });
      }
      onCellsEdited(edits);
      return true;
    },
    [config.cols, config.rows, onCellsEdited],
  );

  const handleHeaderClicked = useCallback(
    (col: number, event: HeaderClickedEventArgs) => {
      if (col < 0 || col >= config.cols) {
        return;
      }
      onColumnHeaderClick(col, { isDoubleClick: event.isDoubleClick === true });
    },
    [config.cols, onColumnHeaderClick],
  );

  const keybindings = useMemo(
    () => ({
      // Glide default activateCell is Space|Enter|shift+Enter; add F2 for spreadsheet parity (#73).
      activateCell: " |Enter|shift+Enter|F2",
    }),
    [],
  );

  return (
    <div className="matrix-grid-container" data-testid="matrix-grid" ref={containerRef}>
      <DataEditor
        ref={gridRef}
        getCellContent={cellContent}
        getCellsForSelection={true}
        columns={columns}
        rows={config.rows}
        highlightRegions={groupHighlights}
        rowMarkers={{ kind: "clickable-number", width: 32 }}
        theme={theme}
        gridSelection={gridSelection}
        onCellClicked={handleCellClicked}
        onHeaderClicked={handleHeaderClicked}
        onCellEdited={handleCellEdited}
        onCellsEdited={handleCellsEdited}
        onVisibleRegionChanged={updateGroupLabelPositions}
        onDelete={(deletedSelection) => deletedSelection}
        onPaste={true}
        onGridSelectionChange={handleGridSelectionChange}
        rangeSelect="rect"
        rowSelect="single"
        columnSelect="single"
        drawFocusRing={true}
        cellActivationBehavior="second-click"
        editOnType={true}
        keybindings={keybindings}
        trapFocus={true}
        scrollToActiveCell={true}
        smoothScrollX
        smoothScrollY
        height="100%"
        width="100%"
      />
      <div className="matrix-group-label-layer" aria-hidden={false}>
        {groups.map((group) => {
          const position = groupLabelPositions.find((entry) => entry.id === group.id);
          if (!position) {
            return null;
          }
          const editing = group.id === editingGroupId;
          return (
            <div
              key={group.id}
              className="matrix-group-label-anchor"
              data-testid={`matrix-group-outline-${group.id}`}
              style={{
                left: position.left,
                top: position.top,
                maxWidth: position.maxWidth,
              }}
            >
              {editing ? (
                <input
                  className="matrix-group-label-input"
                  data-testid="matrix-group-label-input"
                  value={groupLabelDraft}
                  onChange={(event) => onGroupLabelDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onGroupLabelSave();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      // WHY: Removing the input causes blur; mark it so Escape remains a real cancel.
                      skipNextGroupLabelBlurSave.current = true;
                      onGroupLabelCancel();
                    }
                  }}
                  onBlur={() => {
                    if (skipNextGroupLabelBlurSave.current) {
                      skipNextGroupLabelBlurSave.current = false;
                      return;
                    }
                    onGroupLabelSave();
                  }}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className="matrix-group-label-button"
                  data-testid={`matrix-group-label-${group.id}`}
                  onClick={() => onGroupLabelEditStart(group)}
                >
                  {group.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
