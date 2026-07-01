import { expect, test } from "@playwright/test";
import {
  clickMatrixCell,
  commitGridEdit,
  expectActiveSelection,
  expectCellStored,
  focusMatrixCell,
  prepareMatrixGrid,
  typeDirectlyInGrid,
} from "./matrix-grid-helpers.ts";

test.describe("Feature: Context Matrix real user flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("context-matrix-onboarding-dismissed", "true");
      localStorage.removeItem("context-matrix-history");
      localStorage.removeItem("context-matrix-recent-ranges");
    });
    await prepareMatrixGrid(page);
  });

  test("Scenario: User edits cells, runs AI, and reruns from history", async ({ page }) => {
    await expect(page.locator("#portal")).toBeAttached();

    await clickMatrixCell(page, "A1");
    await typeDirectlyInGrid(page, "A1", "q1");
    await commitGridEdit(page, "Tab");
    await expectActiveSelection(page, "B1");
    await typeDirectlyInGrid(page, "B1", "q2");
    await commitGridEdit(page, "Enter");
    await expectCellStored(page, "A1", "q1");
    await expectCellStored(page, "B1", "q2");

    await focusMatrixCell(page, "A1");
    const canvas = page.getByTestId("data-grid-canvas");
    await canvas.focus();
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.up("Shift");

    const addContext = page.getByTestId("matrix-add-context");
    if (await addContext.isEnabled()) {
      await addContext.click();
    }

    await focusMatrixCell(page, "E1");
    await page.getByTestId("matrix-set-target").click();

    const prompt = "E2E real user flow: write concise summary in the target cell";
    await page.getByTestId("matrix-composer-input").fill(prompt);

    const matrixRunPromise = page.waitForResponse(
      (response) => response.url().includes("/api/matrix-run") && response.status() === 200,
      { timeout: 60000 },
    );
    await page.getByTestId("matrix-run").click();
    await matrixRunPromise;

    await expect(page.getByTestId("matrix-status-bar")).toContainText(/Run applied/i, {
      timeout: 60000,
    });
    await expect(page.locator('[data-testid^="history-entry-"]').first()).toBeVisible();

    await page.locator('[data-testid^="history-entry-"]').first().click();
    await expect(page.getByTestId("matrix-history-detail")).toBeVisible();
    await page.getByTestId("history-detail-rerun").click();
    await expect(page.getByTestId("matrix-composer-input")).toHaveValue(prompt);
  });
});
