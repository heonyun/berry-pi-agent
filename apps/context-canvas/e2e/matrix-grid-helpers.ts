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

async function gridCanvas(page: Page) {
  return page.getByTestId("data-grid-canvas");
}

function cellLabel(col: number, row: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
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

/** Type on the focused grid canvas (edit-on-type / navigation scenarios). */
export async function typeIntoMatrixCell(page: Page, text: string): Promise<void> {
  const canvas = await gridCanvas(page);
  await canvas.focus();
  await canvas.pressSequentially(text, { delay: 30 });
}

/** Commit body text for the selected cell through the detail pane. */
export async function commitDetailCellBody(page: Page, text: string): Promise<void> {
  const textarea = page.getByTestId("side-panel-textarea");
  await expect(textarea).toBeVisible();
  await textarea.fill(text);
  await page.getByTestId("side-panel-save").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("matrix-status-bar")).toContainText("updated");
  const canvas = await gridCanvas(page);
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
  const label = `${String.fromCharCode(65 + col)}${row + 1}`;
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
