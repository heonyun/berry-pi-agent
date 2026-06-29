import { useCallback, useMemo, type ReactElement } from "react";
import {
  DataEditor,
  GridCellKind,
  type EditableGridCell,
  type GridColumn,
  type GridSelection,
  type Item,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { getColumnHeader, type MatrixDocument } from "../shared/domain.ts";
import {
  getCellContent,
  getMatrixGridConfig,
  getMatrixGridTheme,
} from "../adapters/matrix-glide.ts";
import {
  gridSelectionToMatrixSelection,
  rangeRefToGridSelection,
  type MatrixGridSelectionState,
} from "../adapters/matrix-grid-selection.ts";

export type { MatrixGridSelectionState };

export interface MatrixGridProps {
  readonly document: MatrixDocument;
  readonly selection: MatrixGridSelectionState | null;
  readonly onCellClick: (row: number, col: number) => void;
  readonly onCellEdited: (row: number, col: number, body: string) => void;
  readonly onSelectionChange: (selection: MatrixGridSelectionState | null) => void;
}

export function MatrixGrid({
  document,
  selection,
  onCellClick,
  onCellEdited,
  onSelectionChange,
}: MatrixGridProps): ReactElement {
  const config = useMemo(() => getMatrixGridConfig(document), [document]);
  const theme = useMemo(() => getMatrixGridTheme(), []);

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

  const gridSelection = useMemo((): GridSelection | undefined => {
    if (!selection) {
      return undefined;
    }
    return rangeRefToGridSelection(selection, {
      col: selection.activeCol,
      row: selection.activeRow,
    });
  }, [selection]);

  const handleGridSelectionChange = useCallback(
    (newSelection: GridSelection) => {
      onSelectionChange(gridSelectionToMatrixSelection(newSelection));
    },
    [onSelectionChange],
  );

  const handleCellClicked = (cell: Item) => {
    const [col, row] = cell;
    if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) {
      return;
    }
    onCellClick(row, col);
  };

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

  return (
    <div className="matrix-grid-container" data-testid="matrix-grid">
      <DataEditor
        getCellContent={cellContent}
        getCellsForSelection={true}
        columns={columns}
        rows={config.rows}
        rowMarkers="number"
        theme={theme}
        gridSelection={gridSelection}
        onCellClicked={handleCellClicked}
        onCellEdited={handleCellEdited}
        onGridSelectionChange={handleGridSelectionChange}
        rangeSelect="rect"
        drawFocusRing={true}
        cellActivationBehavior="second-click"
        editOnType={true}
        trapFocus={true}
        scrollToActiveCell={true}
        smoothScrollX
        smoothScrollY
        height="100%"
        width="100%"
      />
    </div>
  );
}
