import { expect, test } from "@playwright/test";
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
} from "./matrix-grid-helpers.ts";

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
