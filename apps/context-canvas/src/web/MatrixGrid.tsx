import { useMemo, type ReactElement } from "react";
import { DataEditor, type GridColumn, type GridSelection, type Item } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { getColumnHeader, type MatrixDocument } from "../shared/domain.ts";
import { getCellContent, getMatrixGridConfig } from "../adapters/matrix-glide.ts";

export interface MatrixGridProps {
  readonly document: MatrixDocument;
  readonly onCellClick: (row: number, col: number) => void;
  readonly onSelectionChange: (selection: {
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
  } | null) => void;
}

export function MatrixGrid({
  document,
  onCellClick,
  onSelectionChange,
}: MatrixGridProps): ReactElement {
  const config = useMemo(() => getMatrixGridConfig(document), [document]);

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

  const handleGridSelectionChange = (newSelection: GridSelection) => {
    if (!newSelection.current) {
      onSelectionChange(null);
      return;
    }
    const { range } = newSelection.current;
    if (range.width <= 0 || range.height <= 0) {
      onSelectionChange(null);
      return;
    }
    onSelectionChange({
      startCol: range.x,
      startRow: range.y,
      endCol: range.x + range.width - 1,
      endRow: range.y + range.height - 1,
    });
  };

  const handleCellClicked = (cell: Item) => {
    const [col, row] = cell;
    if (row < 0 || col < 0 || row >= config.rows || col >= config.cols) {
      return;
    }
    onCellClick(row, col);
  };

  return (
    <div className="matrix-grid-container" data-testid="matrix-grid">
      <DataEditor
        getCellContent={cellContent}
        getCellsForSelection={true}
        columns={columns}
        rows={config.rows}
        rowMarkers="number"
        onCellClicked={handleCellClicked}
        onGridSelectionChange={handleGridSelectionChange}
        rangeSelect="rect"
        smoothScrollX
        smoothScrollY
        height="100%"
        width="100%"
      />
    </div>
  );
}
