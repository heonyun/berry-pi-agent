import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
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
  type GridKeyEventArgs,
  type HeaderClickedEventArgs,
  type GridSelection,
  type Item,
  type ProvideEditorCallback,
  type ProvideEditorComponent,
  type SelectionRange,
  type TextCell,
} from "@glideapps/glide-data-grid";
import { shouldCancelMatrixEditOnTypeForIme } from "../shared/matrix-ime.ts";
import "@glideapps/glide-data-grid/dist/index.css";
import { getColumnHeader, type MatrixDocument, type MatrixGroup } from "../shared/domain.ts";
import { getMatrixColumnWidth } from "../shared/matrix-column-width.ts";
import { clampMatrixRowHeight, getMatrixRowHeight } from "../shared/matrix-row-height.ts";
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
import { ImeTextarea } from "./ImeTextarea.tsx";

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
  readonly onColumnResize?: (col: number, width: number) => void;
  readonly onRowResize?: (row: number, height: number) => void;
  readonly onGroupLabelClick?: (
    group: MatrixGroup,
    options: { readonly isDoubleClick: boolean },
  ) => void;
  readonly onGroupLabelOffsetChange?: (
    group: MatrixGroup,
    offset: { readonly x: number; readonly y: number },
  ) => void;
  readonly onGroupLabelDraftChange: (label: string) => void;
  readonly onGroupLabelSave: () => void;
  readonly onGroupLabelCancel: () => void;
  readonly onSelectionChange: (selection: MatrixGridSelectionState | null) => void;
}

interface GroupLabelPosition {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly maxWidth: number;
  readonly boundaryLeft: number;
  readonly boundaryTop: number;
  readonly boundaryWidth: number;
  readonly boundaryHeight: number;
}

interface RowResizeHandlePosition {
  readonly row: number;
  readonly top: number;
}

interface CellCornerDotPosition {
  readonly row: number;
  readonly col: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface RowResizeDrag {
  readonly row: number;
  readonly startY: number;
  readonly startHeight: number;
  readonly currentHeight: number;
}

interface GroupLabelDrag {
  readonly group: MatrixGroup;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly baseOffset: { readonly x: number; readonly y: number };
  readonly currentOffset: { readonly x: number; readonly y: number };
  readonly moved: boolean;
}

interface MatrixVisibleRows {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly ty: number;
}

const ROW_RESIZE_HANDLE_WIDTH = 32;
const MATRIX_HEADER_HEIGHT = 36;
const MATRIX_IME_EDITOR_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: "100%",
  boxSizing: "border-box",
  resize: "none",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  lineHeight: "inherit",
  padding: "3px 8.5px",
};

function applyValidatedSelection(
  textarea: HTMLTextAreaElement | null,
  range: SelectionRange | undefined,
): void {
  if (!textarea || range === undefined) {
    return;
  }
  const [start, end] = typeof range === "number" ? [range, range] : range;
  textarea.setSelectionRange(start, end);
}

const MatrixImeTextEditor: ProvideEditorComponent<TextCell> = ({
  isHighlighted,
  onChange,
  onFinishedEditing,
  validatedSelection,
  value,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || value.readonly === true) {
      return;
    }
    const length = value.data.length;
    textarea.focus();
    textarea.setSelectionRange(isHighlighted ? 0 : length, length);
  }, [isHighlighted, value.data.length, value.readonly]);

  useLayoutEffect(() => {
    applyValidatedSelection(textareaRef.current, validatedSelection);
  }, [validatedSelection]);

  const updateValue = useCallback(
    (next: string): TextCell => ({
      ...value,
      data: next,
      displayData: next,
    }),
    [value],
  );

  const handleLocalChange = useCallback(
    (next: string) => {
      onChange(updateValue(next));
    },
    [onChange, updateValue],
  );

  const finishEditing = useCallback(
    (next?: TextCell) => {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      onFinishedEditing(next);
    },
    [onFinishedEditing],
  );

  const handleValueChange = useCallback(
    (next: string) => {
      finishEditing(updateValue(next));
    },
    [finishEditing, updateValue],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishEditing(undefined);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        finishEditing(updateValue(event.currentTarget.value));
      }
    },
    [finishEditing, updateValue],
  );

  return (
    <ImeTextarea
      ref={textareaRef}
      aria-label="Matrix cell editor"
      className="matrix-grid-ime-editor gdg-input"
      disabled={value.readonly === true}
      value={value.data}
      style={MATRIX_IME_EDITOR_STYLE}
      onKeyDown={handleKeyDown}
      onLocalChange={handleLocalChange}
      onValueChange={handleValueChange}
    />
  );
};

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
  onColumnResize = () => {},
  onRowResize = () => {},
  onGroupLabelClick = () => {},
  onGroupLabelOffsetChange = () => {},
  onGroupLabelDraftChange,
  onGroupLabelSave,
  onGroupLabelCancel,
  onSelectionChange,
}: MatrixGridProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<DataEditorRef | null>(null);
  const config = useMemo(() => getMatrixGridConfig(document), [document]);
  const theme = useMemo(() => getMatrixGridTheme(), []);
  const [groupLabelPositions, setGroupLabelPositions] = useState<readonly GroupLabelPosition[]>([]);
  const [rowResizeHandlePositions, setRowResizeHandlePositions] = useState<
    readonly RowResizeHandlePosition[]
  >([]);
  const [cellCornerDotPositions, setCellCornerDotPositions] = useState<
    readonly CellCornerDotPosition[]
  >([]);
  const [rowResizeDrag, setRowResizeDrag] = useState<RowResizeDrag | null>(null);
  const [groupLabelDrag, setGroupLabelDrag] = useState<GroupLabelDrag | null>(null);
  const groupLabelDragRef = useRef<GroupLabelDrag | null>(null);
  const suppressNextGroupLabelClick = useRef(false);
  const visibleRowsRef = useRef<MatrixVisibleRows>({
    x: 0,
    y: 0,
    width: config.cols,
    height: config.rows,
    ty: 0,
  });
  const skipNextGroupLabelBlurSave = useRef(false);

  const columns = useMemo(
    () =>
      Array.from({ length: config.cols }, (_, i) => ({
        id: String(i),
        title: getColumnHeader(document, i),
        width: getMatrixColumnWidth(document, i),
      })) as readonly GridColumn[],
    [config.cols, document],
  );

  const handleColumnResize = useCallback(
    (_column: GridColumn, newWidth: number, colIndex: number) => {
      if (colIndex < 0 || colIndex >= config.cols) {
        return;
      }
      onColumnResize(colIndex, newWidth);
    },
    [config.cols, onColumnResize],
  );

  const rowHeight = useCallback(
    (row: number) =>
      rowResizeDrag?.row === row
        ? rowResizeDrag.currentHeight
        : getMatrixRowHeight(document, row),
    [document, rowResizeDrag],
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
      setRowResizeHandlePositions([]);
      setCellCornerDotPositions([]);
      return;
    }
    const containerBounds = container.getBoundingClientRect();
    const nextPositions: GroupLabelPosition[] = [];
    for (const group of groups) {
      const bounds = grid.getBounds(group.range.startCol, group.range.startRow);
      const endBounds = grid.getBounds(group.range.endCol, group.range.endRow);
      if (!bounds || !endBounds) {
        continue;
      }
      // CONTRACT: Glide DataEditorRef.getBounds returns viewport coordinates; subtract the
      // container viewport rect to place labels in this absolute overlay layer.
      const boundaryLeft = bounds.x - containerBounds.x;
      const boundaryTop = bounds.y - containerBounds.y;
      const boundaryRight = endBounds.x + endBounds.width - containerBounds.x;
      const boundaryBottom = endBounds.y + endBounds.height - containerBounds.y;
      const boundaryWidth = boundaryRight - boundaryLeft;
      const boundaryHeight = boundaryBottom - boundaryTop;
      const maxWidth = Math.max(72, Math.min(190, bounds.width + 88));
      const previewOffset =
        groupLabelDrag?.group.id === group.id ? groupLabelDrag.currentOffset : group.labelOffset;
      const offsetX = previewOffset?.x ?? 0;
      const offsetY = previewOffset?.y ?? 0;
      const maxLeft = Math.max(4, containerBounds.width - maxWidth - 4);
      const maxTop = Math.max(2, containerBounds.height - 24);
      const left = Math.max(4, Math.min(maxLeft, bounds.x - containerBounds.x + 4 + offsetX));
      const top = Math.max(2, Math.min(maxTop, bounds.y - containerBounds.y - 12 + offsetY));
      if (
        boundaryLeft > containerBounds.width ||
        boundaryTop > containerBounds.height ||
        boundaryRight < 0 ||
        boundaryBottom < 0 ||
        boundaryWidth <= 0 ||
        boundaryHeight <= 0
      ) {
        continue;
      }
      nextPositions.push({
        id: group.id,
        left,
        top,
        maxWidth,
        boundaryLeft,
        boundaryTop,
        boundaryWidth,
        boundaryHeight,
      });
    }
    const nextRowResizeHandles: RowResizeHandlePosition[] = [];
    const nextCellCornerDots: CellCornerDotPosition[] = [];
    const canvas = container.querySelector<HTMLElement>('[data-testid="data-grid-canvas"]');
    const canvasBounds = canvas?.getBoundingClientRect();
    if (canvasBounds) {
      const visibleRows = visibleRowsRef.current;
      const startRow = Math.max(0, Math.floor(visibleRows.y));
      const endRow = Math.min(config.rows, Math.ceil(visibleRows.y + visibleRows.height) + 1);
      let cursorTop = canvasBounds.y - containerBounds.y + MATRIX_HEADER_HEIGHT + visibleRows.ty;
      // WHY: Glide has no row-resize event; marker handles follow the visible region's rowHeight math.
      for (let row = startRow; row < endRow; row += 1) {
        cursorTop += rowHeight(row);
        const top = cursorTop - 3;
        if (!Number.isFinite(top)) {
          break;
        }
        if (top < 0 || top > containerBounds.height) {
          if (top > containerBounds.height) {
            break;
          }
          continue;
        }
        nextRowResizeHandles.push({ row, top });
      }

      const startCol = Math.max(0, Math.floor(visibleRows.x));
      const endCol = Math.min(config.cols, Math.ceil(visibleRows.x + visibleRows.width) + 1);
      // WHY: issue-99 corner dots are visual affordances; grid interaction stays in Glide.
      // INVARIANT: This overlay must remain pointer-events:none so selection/edit/clipboard stay unchanged.
      for (let row = startRow; row < endRow; row += 1) {
        for (let col = startCol; col < endCol; col += 1) {
          const bounds = grid.getBounds(col, row);
          if (!bounds) {
            continue;
          }
          const left = bounds.x - containerBounds.x;
          const top = bounds.y - containerBounds.y;
          const right = left + bounds.width;
          const bottom = top + bounds.height;
          if (
            left > containerBounds.width ||
            top > containerBounds.height ||
            right < 0 ||
            bottom < 0 ||
            bounds.width <= 0 ||
            bounds.height <= 0
          ) {
            continue;
          }
          nextCellCornerDots.push({
            row,
            col,
            left,
            top,
            width: bounds.width,
            height: bounds.height,
          });
        }
      }
    }
    setGroupLabelPositions(nextPositions);
    setRowResizeHandlePositions(nextRowResizeHandles);
    setCellCornerDotPositions(nextCellCornerDots);
  }, [config.cols, config.rows, groupLabelDrag, groups, rowHeight]);

  const handleGroupLabelPointerDown = useCallback(
    (group: MatrixGroup, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || editingGroupId !== null) {
        return;
      }
      suppressNextGroupLabelClick.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      const baseOffset = group.labelOffset ?? { x: 0, y: 0 };
      const nextDrag = {
        group,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseOffset,
        currentOffset: baseOffset,
        moved: false,
      };
      groupLabelDragRef.current = nextDrag;
      setGroupLabelDrag(nextDrag);
    },
    [editingGroupId],
  );

  const handleGroupLabelPointerMove = useCallback(
    (group: MatrixGroup, event: ReactPointerEvent<HTMLButtonElement>) => {
      const activeDrag = groupLabelDragRef.current;
      if (!activeDrag || activeDrag.group.id !== group.id || activeDrag.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - activeDrag.startX;
      const dy = event.clientY - activeDrag.startY;
      const moved = activeDrag.moved || Math.abs(dx) + Math.abs(dy) >= 4;
      const nextDrag = {
        ...activeDrag,
        currentOffset: {
          x: activeDrag.baseOffset.x + dx,
          y: activeDrag.baseOffset.y + dy,
        },
        moved,
      };
      groupLabelDragRef.current = nextDrag;
      setGroupLabelDrag(nextDrag);
    },
    [],
  );

  const handleGroupLabelPointerUp = useCallback(
    (group: MatrixGroup, event: ReactPointerEvent<HTMLButtonElement>) => {
      const activeDrag = groupLabelDragRef.current;
      if (!activeDrag || activeDrag.group.id !== group.id || activeDrag.pointerId !== event.pointerId) {
        return;
      }
      groupLabelDragRef.current = null;
      setGroupLabelDrag(null);
      if (!activeDrag.moved) {
        return;
      }
      suppressNextGroupLabelClick.current = true;
      // WHY: Some drag releases do not emit a follow-up click; the click handler clears this sooner when one does.
      window.setTimeout(() => {
        suppressNextGroupLabelClick.current = false;
      }, 0);
      event.preventDefault();
      event.stopPropagation();
      // INVARIANT: Persist group label offset only after drag end; click and double-click semantics stay intact.
      onGroupLabelOffsetChange(group, activeDrag.currentOffset);
      updateGroupLabelPositions();
    },
    [onGroupLabelOffsetChange, updateGroupLabelPositions],
  );

  const handleGroupLabelPointerCancel = useCallback(
    (group: MatrixGroup, event: ReactPointerEvent<HTMLButtonElement>) => {
      const activeDrag = groupLabelDragRef.current;
      if (!activeDrag || activeDrag.group.id !== group.id || activeDrag.pointerId !== event.pointerId) {
        return;
      }
      groupLabelDragRef.current = null;
      setGroupLabelDrag(null);
      suppressNextGroupLabelClick.current = false;
    },
    [],
  );

  const handleRowResizePointerDown = useCallback(
    (row: number, event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startHeight = getMatrixRowHeight(document, row);
      event.currentTarget.setPointerCapture(event.pointerId);
      setRowResizeDrag({
        row,
        startY: event.clientY,
        startHeight,
        currentHeight: startHeight,
      });
    },
    [document],
  );

  useEffect(() => {
    if (!rowResizeDrag) {
      return undefined;
    }
    const nextHeight = (clientY: number) =>
      clampMatrixRowHeight(rowResizeDrag.startHeight + clientY - rowResizeDrag.startY);
    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const currentHeight = nextHeight(event.clientY);
      setRowResizeDrag((current) =>
        current ? { ...current, currentHeight } : current,
      );
    };
    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault();
      const height = nextHeight(event.clientY);
      setRowResizeDrag(null);
      // INVARIANT: Persist only on drag end, matching column resize-end behavior (#96, #97).
      onRowResize(rowResizeDrag.row, height);
      updateGroupLabelPositions();
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onRowResize, rowResizeDrag, updateGroupLabelPositions]);

  const handleVisibleRegionChanged = useCallback<NonNullable<DataEditorProps["onVisibleRegionChanged"]>>(
    (range, _tx, ty) => {
      visibleRowsRef.current = { x: range.x, y: range.y, width: range.width, height: range.height, ty };
      updateGroupLabelPositions();
    },
    [updateGroupLabelPositions],
  );

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

  const provideEditor = useCallback<ProvideEditorCallback<TextCell>>((cell) => {
    if (cell.kind !== GridCellKind.Text) {
      return undefined;
    }
    return {
      // CONTRACT: replacing Glide's GrowingEntry must preserve `.gdg-input`
      // so matrix shortcut guards still recognize an active overlay editor.
      editor: MatrixImeTextEditor,
      disablePadding: cell.allowWrapping === true,
    };
  }, []);

  const handleGridKeyDown = useCallback((event: GridKeyEventArgs) => {
    const native = event.rawEvent?.nativeEvent;
    // WHY: Glide editOnType calls reselect(..., event.key) before IME composition; cancel avoids Latin seed.
    // CONTRACT: event.cancel() skips edit-on-type only; F2/Enter activation unchanged.
    // RELATED: issue-93, matrix-ime.test.ts
    if (
      shouldCancelMatrixEditOnTypeForIme({
        key: event.key,
        keyCode: event.keyCode,
        isComposing: native?.isComposing,
      })
    ) {
      event.cancel();
    }
  }, []);

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
        rowHeight={rowHeight}
        theme={theme}
        gridSelection={gridSelection}
        onCellClicked={handleCellClicked}
        onHeaderClicked={handleHeaderClicked}
        // WHY: persist only on resize end; onColumnResize interim values can report min width (#96).
        onColumnResizeEnd={handleColumnResize}
        onCellEdited={handleCellEdited}
        onCellsEdited={handleCellsEdited}
        onVisibleRegionChanged={handleVisibleRegionChanged}
        onDelete={(deletedSelection) => deletedSelection}
        onPaste={true}
        onGridSelectionChange={handleGridSelectionChange}
        onKeyDown={handleGridKeyDown}
        rangeSelect="rect"
        rowSelect="single"
        columnSelect="single"
        drawFocusRing={true}
        cellActivationBehavior="second-click"
        editOnType={true}
        keybindings={keybindings}
        provideEditor={provideEditor as DataEditorProps["provideEditor"]}
        trapFocus={true}
        scrollToActiveCell={true}
        smoothScrollX
        smoothScrollY
        height="100%"
        width="100%"
      />
      <div className="matrix-row-resize-layer" aria-hidden={false}>
        {rowResizeHandlePositions.map((position) => (
          <button
            key={position.row}
            type="button"
            className="matrix-row-resize-handle"
            data-testid={`matrix-row-resize-${position.row}`}
            aria-label={`Resize row ${position.row + 1}`}
            style={{
              top: position.top,
              width: ROW_RESIZE_HANDLE_WIDTH,
            }}
            onPointerDown={(event) => handleRowResizePointerDown(position.row, event)}
          />
        ))}
      </div>
      <div className="matrix-cell-corner-dot-layer" aria-hidden="true">
        {cellCornerDotPositions.map((position) => (
          <div
            key={`${position.row}:${position.col}`}
            className="matrix-cell-corner-dot-anchor"
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              height: position.height,
            }}
          >
            {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => (
              <span
                key={corner}
                className={`matrix-cell-corner-dot matrix-cell-corner-dot-${corner}`}
                data-testid={`matrix-cell-corner-dot-${position.row}-${position.col}-${corner}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="matrix-group-label-layer" aria-hidden={false}>
        {groups.map((group) => {
          const position = groupLabelPositions.find((entry) => entry.id === group.id);
          if (!position) {
            return null;
          }
          const editing = group.id === editingGroupId;
          return (
            <Fragment key={group.id}>
              <div
                className="matrix-group-boundary"
                data-testid={`matrix-group-boundary-${group.id}`}
                aria-hidden="true"
                style={{
                  left: position.boundaryLeft,
                  top: position.boundaryTop,
                  width: position.boundaryWidth,
                  height: position.boundaryHeight,
                }}
              >
                {/* ASSUMPTION: issue-98 dots are static affordances; interactive grid corners are I07. */}
                {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => (
                  <span
                    key={corner}
                    className={`matrix-group-corner-dot matrix-group-corner-dot-${corner}`}
                    data-testid={`matrix-group-corner-dot-${group.id}-${corner}`}
                  />
                ))}
              </div>
              <div
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
                    onPointerDown={(event) => handleGroupLabelPointerDown(group, event)}
                    onPointerMove={(event) => handleGroupLabelPointerMove(group, event)}
                    onPointerUp={(event) => handleGroupLabelPointerUp(group, event)}
                    onPointerCancel={(event) => handleGroupLabelPointerCancel(group, event)}
                    onClick={() => {
                      if (suppressNextGroupLabelClick.current) {
                        suppressNextGroupLabelClick.current = false;
                        return;
                      }
                      onGroupLabelClick(group, { isDoubleClick: false });
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      onGroupLabelClick(group, { isDoubleClick: true });
                    }}
                  >
                    {group.label}
                  </button>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
