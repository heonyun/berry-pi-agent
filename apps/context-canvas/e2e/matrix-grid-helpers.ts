import { expect, type Page } from "@playwright/test";

/** Approximate layout for glide grid with rowMarkers="number" and 120px columns. */
const COL_WIDTH = 120;
const ROW_HEIGHT = 34;
const GRID_INSET_X = 80;
const GRID_INSET_Y = 60;

export function parseCellAddress(address: string): { col: number; row: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(address.trim());
  if (!match) {
    throw new Error(`Invalid cell address: ${address}`);
  }
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  col -= 1;
  const row = Number.parseInt(match[2], 10) - 1;
  return { col, row };
}

export async function prepareMatrixGrid(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("context-matrix-onboarding-dismissed", "true");
  });
  await page.goto("/");
  await expect(page.getByTestId("matrix-grid")).toBeVisible();
  const onboardingDismiss = page.getByTestId("matrix-onboarding").getByRole("button", {
    name: "Got it",
  });
  if (await onboardingDismiss.isVisible().catch(() => false)) {
    await onboardingDismiss.click();
  }
}

function cellCenter(box: { x: number; y: number }, col: number, row: number): { x: number; y: number } {
  return {
    x: box.x + GRID_INSET_X + col * COL_WIDTH,
    y: box.y + GRID_INSET_Y + row * ROW_HEIGHT,
  };
}

function cellCenterOnCanvas(col: number, row: number): { x: number; y: number } {
  const ROW_MARKER_WIDTH = 32;
  const HEADER_HEIGHT = 36;
  return {
    x: ROW_MARKER_WIDTH + col * COL_WIDTH + COL_WIDTH / 2,
    y: HEADER_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2,
  };
}

/** Select a cell via keyboard arrows from the current selection (or A1 anchor on cold start). */
export async function focusMatrixCell(page: Page, address: string): Promise<void> {
  const target = parseCellAddress(address);
  const canvas = await gridCanvas(page);
  const summary = await page.getByTestId("matrix-status-selection").textContent({ timeout: 5000 }).catch(() => null);
  const activeMatch = /Selection:\s*([A-Z]+\d+)/i.exec(summary ?? "");
  let current = activeMatch ? parseCellAddress(activeMatch[1]) : null;

  if (current === null) {
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }
    const anchor = cellCenterOnCanvas(0, 0);
    await page.mouse.click(box.x + anchor.x, box.y + anchor.y);
    current = { col: 0, row: 0 };
  }

  await canvas.focus();
  const rowDelta = target.row - current.row;
  const colDelta = target.col - current.col;
  for (let i = 0; i < Math.abs(rowDelta); i++) {
    await page.keyboard.press(rowDelta > 0 ? "ArrowDown" : "ArrowUp");
  }
  for (let i = 0; i < Math.abs(colDelta); i++) {
    await page.keyboard.press(colDelta > 0 ? "ArrowRight" : "ArrowLeft");
  }
  await expect(page.getByTestId("matrix-status-selection")).toContainText(cellLabel(target.col, target.row));
}

async function gridCanvas(page: Page) {
  return page.getByTestId("data-grid-canvas");
}

function cellLabel(col: number, row: number): string {
  let n = col + 1;
  let label = "";
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return `${label}${row + 1}`;
}

export async function clickMatrixCell(page: Page, address: string): Promise<void> {
  const { col, row } = parseCellAddress(address);
  const grid = page.getByTestId("matrix-grid");
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  const { x, y } = cellCenter(box, col, row);
  await page.mouse.click(x, y);
  await expect(page.getByTestId("matrix-status-selection")).toContainText(cellLabel(col, row));
  const canvas = await gridCanvas(page);
  await canvas.focus();
}

/** Type into the grid via edit-on-type (first key opens overlay, then fill). */
export async function typeDirectlyInGrid(page: Page, _address: string, text: string): Promise<void> {
  const canvas = await gridCanvas(page);
  await canvas.focus();
  await page.keyboard.press(text[0]!);
  const overlayInput = page.locator(".gdg-input");
  await overlayInput.waitFor({ state: "visible", timeout: 5000 });
  await overlayInput.fill(text);
}

export async function commitGridEdit(page: Page, key: "Enter" | "Tab"): Promise<void> {
  const overlayInput = page.locator(".gdg-input");
  if (await overlayInput.isVisible().catch(() => false)) {
    await overlayInput.press(key);
    await overlayInput.waitFor({ state: "hidden", timeout: 3000 });
    return;
  }
  const canvas = await gridCanvas(page);
  await canvas.focus();
  await page.keyboard.press(key);
}

/** Assert cell body persisted in domain (re-select and read detail pane). */
export async function expectCellStored(page: Page, address: string, body: string): Promise<void> {
  await page.locator(".gdg-input").waitFor({ state: "hidden", timeout: 3000 });
  await focusMatrixCell(page, address);
  await expectDetailMarkdownBody(page, body);
}

/** Assert status bar shows inline grid commit for a cell. */
export async function expectCellCommitted(page: Page, address: string): Promise<void> {
  const label = address.toUpperCase();
  await expect(page.getByTestId("matrix-status-bar")).toContainText(`Cell ${label} updated`);
}

export async function fillCellAndMove(
  page: Page,
  address: string,
  text: string,
  key: "Enter" | "Tab",
  options: { selectCell?: boolean } = {},
): Promise<void> {
  if (options.selectCell) {
    await clickMatrixCell(page, address);
  } else {
    await expectActiveSelection(page, address);
  }
  await typeDirectlyInGrid(page, address, text);
  await commitGridEdit(page, key);
}

/**
 * Fill A1:B2 with Tab/Enter navigation.
 * Row 1: A1 Tab B1; row 2: A2 Tab B2 (Enter commits and leaves selection on B2).
 */
export async function fill2x2Matrix(
  page: Page,
  values: { a1: string; b1: string; a2: string; b2: string },
): Promise<void> {
  await fillCellAndMove(page, "A1", values.a1, "Tab", { selectCell: true });
  await fillCellAndMove(page, "B1", values.b1, "Enter");
  await focusMatrixCell(page, "A2");
  await fillCellAndMove(page, "A2", values.a2, "Tab");
  await fillCellAndMove(page, "B2", values.b2, "Enter");
}

const ROW_MARKER_WIDTH = 32;
const HEADER_HEIGHT = 36;

export async function clickRowMarker(page: Page, rowNumber: number): Promise<void> {
  const row = rowNumber - 1;
  const canvas = await gridCanvas(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  const x = box.x + ROW_MARKER_WIDTH / 2;
  const y = box.y + HEADER_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2;
  await page.mouse.click(x, y);
  await canvas.focus();
}

export async function clickColumnHeader(page: Page, colLetter: string): Promise<void> {
  const { col } = parseCellAddress(`${colLetter}1`);
  const canvas = await gridCanvas(page);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  const x = box.x + ROW_MARKER_WIDTH + col * COL_WIDTH + COL_WIDTH / 2;
  const y = box.y + HEADER_HEIGHT / 2;
  await page.mouse.click(x, y);
  await canvas.focus();
}

export async function dragMatrixRange(
  page: Page,
  fromAddress: string,
  toAddress: string,
): Promise<void> {
  const from = parseCellAddress(fromAddress);
  const to = parseCellAddress(toAddress);
  const grid = page.getByTestId("matrix-grid");
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  const start = cellCenter(box, from.col, from.row);
  const end = cellCenter(box, to.col, to.row);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

export async function expectActiveSelection(page: Page, address: string): Promise<void> {
  const { col, row } = parseCellAddress(address);
  const label = cellLabel(col, row);
  const summary = page.getByTestId("matrix-status-selection");
  await expect(summary).toContainText(label);
  await expect(summary).not.toContainText(`${label}0`);
}

export async function expectSelectionSummary(
  page: Page,
  rangeLabel: string,
  sizeLabel: string,
): Promise<void> {
  const summary = page.getByTestId("matrix-status-selection");
  await expect(summary).toContainText(rangeLabel);
  await expect(summary).toContainText(sizeLabel);
}

export async function expectDetailMarkdownBody(page: Page, body: string): Promise<void> {
  await expect(page.getByTestId("side-panel-textarea")).toHaveValue(body);
}

export async function expectComposerAiRangeReady(page: Page): Promise<void> {
  await expect(page.getByTestId("matrix-add-context")).toBeEnabled();
  await expect(page.getByTestId("matrix-set-target")).toBeEnabled();
  await expect(page.getByTestId("matrix-ai-range-hint")).toBeVisible();
  await expect(page.getByTestId("matrix-ai-range-hint")).toContainText("Context");
  await expect(page.getByTestId("matrix-ai-range-hint")).toContainText("Set target");
}
