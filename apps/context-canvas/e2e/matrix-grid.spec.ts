import { expect, test, type Page } from "@playwright/test";
import {
  clickMatrixCell,
  commitGridEdit,
  dragMatrixRange,
  expectActiveSelection,
  expectCellCommitted,
  expectCellStored,
  expectComposerAiRangeReady,
  expectSelectionSummary,
  fill2x2Matrix,
  focusMatrixCell,
  prepareMatrixGrid,
  typeDirectlyInGrid,
  clickRowMarker,
  clickColumnHeader,
} from "./matrix-grid-helpers.ts";

async function selectRangeByKeyboard(page: Page, anchor: string, keys: readonly string[]): Promise<void> {
  await focusMatrixCell(page, anchor);
  const canvas = page.getByTestId("data-grid-canvas");
  await canvas.focus();
  await page.keyboard.down("Shift");
  for (const key of keys) {
    await page.keyboard.press(key);
  }
  await page.keyboard.up("Shift");
}

type MatrixRunRequest = {
  readonly prompt: string;
  readonly targetRange: {
    readonly startRow: number;
    readonly startCol: number;
    readonly endRow: number;
    readonly endCol: number;
  };
  readonly compiled: {
    readonly contextRangeLabels: readonly string[];
    readonly targetRangeLabel: string;
    readonly contextText: string;
  };
};

async function mockMatrixRun(page: Page): Promise<MatrixRunRequest[]> {
  const requests: MatrixRunRequest[] = [];
  await page.route("**/api/matrix-run", async (route) => {
    const request = route.request().postDataJSON() as MatrixRunRequest;
    requests.push(request);
    const { targetRange } = request;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        intent: request.prompt,
        targetRange,
        patches: [
          {
            row: targetRange.startRow,
            col: targetRange.startCol,
            value: "shortcut-result",
            body: "Shortcut result",
            provenance: "e2e",
          },
        ],
      }),
    });
  });
  return requests;
}

test.describe("Feature: Excel-like matrix cell editing", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMatrixGrid(page);
  });

  test("Scenario: Type directly into a selected cell", async ({ page }) => {
    await clickMatrixCell(page, "A1");
    await typeDirectlyInGrid(page, "A1", "hello");
    await commitGridEdit(page, "Enter");

    await expectCellCommitted(page, "A1");
    await expectCellStored(page, "A1", "hello");
  });

  test("Scenario: Enter commits and moves down", async ({ page }) => {
    await clickMatrixCell(page, "A1");
    await typeDirectlyInGrid(page, "A1", "hello");
    await commitGridEdit(page, "Enter");

    await expectCellCommitted(page, "A1");
    await expectActiveSelection(page, "A2");
    await expectCellStored(page, "A1", "hello");
  });

  test("Scenario: Tab commits and moves right", async ({ page }) => {
    await clickMatrixCell(page, "A2");
    await typeDirectlyInGrid(page, "A2", "world");
    await commitGridEdit(page, "Tab");

    await expectCellCommitted(page, "A2");
    await expectActiveSelection(page, "B2");
    await expectCellStored(page, "A2", "world");
  });

  test("Scenario: Shift plus Arrow extends the range", async ({ page }) => {
    await clickMatrixCell(page, "C12");
    await page.keyboard.press("Shift+ArrowRight");

    await expectSelectionSummary(page, "C12:D12", "2×1");
  });

  test("Scenario: Drag selects a rectangular range", async ({ page }) => {
    await dragMatrixRange(page, "A1", "C1");

    await expectSelectionSummary(page, "A1:C1", "3×1");
  });

  test("Scenario: F2 edits the active existing cell", async ({ page }) => {
    await clickMatrixCell(page, "C1");
    await typeDirectlyInGrid(page, "C1", "initial");
    await commitGridEdit(page, "Enter");

    await clickMatrixCell(page, "C1");
    await page.keyboard.press("F2");
    const overlayInput = page.locator(".gdg-input");
    await overlayInput.waitFor({ state: "visible", timeout: 5000 });
    await overlayInput.fill("edited");
    await overlayInput.press("Enter");

    await expectCellStored(page, "C1", "edited");
  });
});

test.describe("Feature: 2x2 matrix workflow", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMatrixGrid(page);
  });

  test("Scenario: Fill a 2x2 matrix with keyboard navigation", async ({ page }) => {
    await fill2x2Matrix(page, { a1: "a1", b1: "b1", a2: "a2", b2: "b2" });

    await expectCellStored(page, "A1", "a1");
    await expectCellStored(page, "B1", "b1");
    await expectCellStored(page, "A2", "a2");
    await expectCellStored(page, "B2", "b2");
    await expectActiveSelection(page, "B2");
  });

  test("Scenario: Select a 2x2 range for AI", async ({ page }) => {
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await focusMatrixCell(page, "A1");
    const canvas = page.getByTestId("data-grid-canvas");
    await canvas.focus();
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.up("Shift");

    await expectSelectionSummary(page, "A1:B2", "2×2");
    await expect(page.getByTestId("matrix-name-box")).toContainText("A1:B2");
    await expect(page.getByTestId("matrix-name-box")).toContainText("2×2");
    await expectComposerAiRangeReady(page);
  });
});

test.describe("Feature: Matrix clipboard", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await prepareMatrixGrid(page);
  });

  test("Scenario: Copy and paste a 2x2 range as TSV cells", async ({ page }) => {
    await page.evaluate(() =>
      navigator.clipboard.writeText("Write a short friendly Korean summary into the target cell."),
    );
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    await expectSelectionSummary(page, "A1:B2", "2×2");

    await page.keyboard.press("Control+C");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("q1\tq2\nq3\tq4");

    await focusMatrixCell(page, "C1");
    await page.keyboard.press("Control+V");

    await expectCellStored(page, "C1", "q1");
    await expectCellStored(page, "D1", "q2");
    await expectCellStored(page, "C2", "q3");
    await expectCellStored(page, "D2", "q4");
  });

  test("Scenario: Cut clears the source range and can paste into another range", async ({ page }) => {
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    await expectSelectionSummary(page, "A1:B2", "2×2");

    await page.keyboard.press("Control+X");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("q1\tq2\nq3\tq4");

    await expectCellStored(page, "A1", "");
    await expectCellStored(page, "B1", "");
    await expectCellStored(page, "A2", "");
    await expectCellStored(page, "B2", "");

    await focusMatrixCell(page, "C1");
    await page.keyboard.press("Control+V");

    await expectCellStored(page, "C1", "q1");
    await expectCellStored(page, "D1", "q2");
    await expectCellStored(page, "C2", "q3");
    await expectCellStored(page, "D2", "q4");
  });

  test("Scenario: Delete clears every selected cell", async ({ page }) => {
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    await expectSelectionSummary(page, "A1:B2", "2×2");

    await page.keyboard.press("Delete");

    await expectCellStored(page, "A1", "");
    await expectCellStored(page, "B1", "");
    await expectCellStored(page, "A2", "");
    await expectCellStored(page, "B2", "");
  });

  test("Scenario: Clipboard shortcuts leave grid cells unchanged while detail textarea has focus", async ({
    page,
  }) => {
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    await expectSelectionSummary(page, "A1:B2", "2×2");

    const detailTextarea = page.getByTestId("side-panel-textarea");
    await detailTextarea.fill("detail clipboard text");
    await detailTextarea.selectText();
    await page.keyboard.press("Control+C");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("detail clipboard text");

    await detailTextarea.fill("");
    await page.evaluate(() => navigator.clipboard.writeText("external paste text"));
    await detailTextarea.focus();
    await page.keyboard.press("Control+V");
    await expect(detailTextarea).toHaveValue("external paste text");

    await detailTextarea.selectText();
    await page.keyboard.press("Control+X");
    await expect(detailTextarea).toHaveValue("");

    await focusMatrixCell(page, "C3");
    await expectCellStored(page, "A1", "q1");
    await expectCellStored(page, "B1", "q2");
    await expectCellStored(page, "A2", "q3");
    await expectCellStored(page, "B2", "q4");
  });
});

test.describe("Feature: Matrix inferred target shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMatrixGrid(page);
  });

  test("Scenario: Ctrl+Enter infers a below target, adds context, and runs", async ({ page }) => {
    const requests = await mockMatrixRun(page);
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    const composerInput = page.getByTestId("matrix-composer-input");
    await composerInput.fill("answer below");
    await composerInput.focus();
    await page.keyboard.press("Control+Enter");

    await expect(page.getByTestId("matrix-status-bar")).toContainText(/Run applied/i, {
      timeout: 60000,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.targetRange).toEqual({
      startRow: 2,
      startCol: 0,
      endRow: 3,
      endCol: 1,
    });
    expect(requests[0]?.compiled.targetRangeLabel).toBe("A3:B4");
    expect(requests[0]?.compiled.contextRangeLabels).toContain("A1:B2 (A1:B2)");
    await expect(page.getByTestId("target-range-chip")).toContainText("A3:B4");
    await expect(page.getByTestId("context-chip-A1:B2")).toBeVisible();
  });

  test("Scenario: Ctrl+Shift+Enter infers a right target and runs", async ({ page }) => {
    const requests = await mockMatrixRun(page);
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    await page.getByTestId("matrix-composer-input").fill("answer right");

    await page.getByTestId("data-grid-canvas").focus();
    await page.keyboard.press("Control+Shift+Enter");

    await expect(page.getByTestId("matrix-status-bar")).toContainText(/Run applied/i, {
      timeout: 60000,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.targetRange).toEqual({
      startRow: 0,
      startCol: 2,
      endRow: 1,
      endCol: 3,
    });
    expect(requests[0]?.compiled.targetRangeLabel).toBe("C1:D2");
    await expect(page.getByTestId("target-range-chip")).toContainText("C1:D2");
  });

  test("Scenario: Ctrl+Shift+Enter respects an existing explicit target", async ({ page }) => {
    const requests = await mockMatrixRun(page);
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await focusMatrixCell(page, "E1");
    await page.getByTestId("matrix-set-target").click();
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    await page.getByTestId("matrix-composer-input").fill("do not retarget");

    await page.getByTestId("data-grid-canvas").focus();
    await page.keyboard.press("Control+Shift+Enter");

    await expect(page.getByTestId("matrix-status-bar")).toContainText("Target already set");
    expect(requests).toHaveLength(0);
    await expect(page.getByTestId("target-range-chip")).toContainText("E1");
  });

  test("Scenario: Ctrl+Enter runs against an existing explicit target", async ({ page }) => {
    const requests = await mockMatrixRun(page);
    await fill2x2Matrix(page, { a1: "q1", b1: "q2", a2: "q3", b2: "q4" });
    await focusMatrixCell(page, "E1");
    await page.getByTestId("matrix-set-target").click();
    await selectRangeByKeyboard(page, "A1", ["ArrowRight", "ArrowDown"]);
    await page.getByTestId("matrix-composer-input").fill("run explicit target");

    await page.getByTestId("data-grid-canvas").focus();
    await page.keyboard.press("Control+Enter");

    await expect(page.getByTestId("matrix-status-bar")).toContainText(/Run applied/i, {
      timeout: 60000,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.targetRange).toEqual({
      startRow: 0,
      startCol: 4,
      endRow: 0,
      endCol: 4,
    });
    await expect(page.getByTestId("target-range-chip")).toContainText("E1");
  });

  test("Scenario: Shortcuts do not run while detail textarea has focus", async ({ page }) => {
    const requests = await mockMatrixRun(page);
    await clickMatrixCell(page, "A1");
    await page.getByTestId("matrix-composer-input").fill("ignored shortcut");
    await page.getByTestId("side-panel-textarea").focus();

    await page.keyboard.press("Control+Enter");

    await expect(page.getByTestId("matrix-status-bar")).not.toContainText(/Run applied/i);
    expect(requests).toHaveLength(0);
  });

  test("Scenario: Repeated shortcut keydown does not run again", async ({ page }) => {
    const requests = await mockMatrixRun(page);
    await clickMatrixCell(page, "A1");
    const composerInput = page.getByTestId("matrix-composer-input");
    await composerInput.fill("ignore repeat");
    await composerInput.focus();

    await page.evaluate(() => {
      const input = document.querySelector('[data-testid="matrix-composer-input"]');
      input?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await expect(page.getByTestId("matrix-status-bar")).not.toContainText(/Run applied/i);
    expect(requests).toHaveLength(0);
  });

  test("Scenario: Out-of-bounds right inference fails visibly and does not run", async ({
    page,
  }) => {
    const requests = await mockMatrixRun(page);
    await focusMatrixCell(page, "AX1");
    await page.getByTestId("matrix-composer-input").fill("no room");

    await page.getByTestId("data-grid-canvas").focus();
    await page.keyboard.press("Control+Shift+Enter");

    await expect(page.getByTestId("matrix-status-bar")).toContainText("No room right");
    expect(requests).toHaveLength(0);
  });

  test("Scenario: Out-of-bounds below inference fails visibly and does not run", async ({
    page,
  }) => {
    const requests = await mockMatrixRun(page);
    await focusMatrixCell(page, "A20");
    await page.getByTestId("matrix-composer-input").fill("no room below");

    await page.getByTestId("data-grid-canvas").focus();
    await page.keyboard.press("Control+Enter");

    await expect(page.getByTestId("matrix-status-bar")).toContainText("No room below");
    expect(requests).toHaveLength(0);
  });
});

test.describe("Feature: Side panel and recent ranges (real clicks)", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMatrixGrid(page);
  });

  test("Scenario: Save detail pane with a normal user click", async ({ page }) => {
    await clickMatrixCell(page, "A1");
    await page.getByTestId("side-panel-textarea").fill("detail body");
    await page.getByTestId("side-panel-frontmatter").fill("status: draft");
    await page.getByTestId("side-panel-save").click({ timeout: 5000 });
    await expect(page.getByTestId("matrix-status-bar")).toContainText("Cell A1 updated");
  });

  test("Scenario: Select a saved range from recent list with a normal user click", async ({
    page,
  }) => {
    await dragMatrixRange(page, "A1", "B1");
    await expectSelectionSummary(page, "A1:B1", "2×1");
    await page.getByTestId("matrix-range-name-input").fill("inputs");
    await page.getByTestId("matrix-name-range").click();
    await expect(page.getByTestId("recent-range-inputs")).toBeVisible();
    await clickMatrixCell(page, "C1");
    await expect(page.getByTestId("matrix-status-selection")).toContainText("C1");
    await page.getByTestId("recent-range-inputs").click({ timeout: 5000 });
    await expectSelectionSummary(page, "A1:B1", "2×1");
  });
});

test.describe("Feature: Row and column header selection", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMatrixGrid(page);
  });

  test("Scenario: Click a row marker to select the whole row", async ({ page }) => {
    await clickRowMarker(page, 2);
    await expectSelectionSummary(page, "A2:AX2", "50×1");
  });

  test("Scenario: Click a column header to select the whole column", async ({ page }) => {
    await clickColumnHeader(page, "B");
    await expectSelectionSummary(page, "B1:B20", "1×20");
  });
});
