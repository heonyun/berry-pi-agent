import { expect, test } from "@playwright/test";
import {
  clickMatrixCell,
  commitDetailCellBody,
  dragMatrixRange,
  expectActiveSelection,
  expectDetailMarkdownBody,
  expectSelectionSummary,
  prepareMatrixGrid,
  typeIntoMatrixCell,
} from "./matrix-grid-helpers.ts";

test.describe("Feature: Matrix grid Excel-like cell interaction", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMatrixGrid(page);
  });

  test("Scenario: Type into a selected cell", async ({ page }) => {
    await clickMatrixCell(page, "A1");
    await commitDetailCellBody(page, "hello");
    await expect(page.getByTestId("matrix-status-bar")).toContainText("Cell A1 updated");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");

    await expectActiveSelection(page, "A1");
    await expectDetailMarkdownBody(page, "hello");
  });

  test("Scenario: Press Enter after editing moves selection down", async ({ page }) => {
    await clickMatrixCell(page, "A1");
    await typeIntoMatrixCell(page, "hello");
    await page.keyboard.press("Enter");

    await expectActiveSelection(page, "A2");
  });

  test("Scenario: Press Tab moves selection right", async ({ page }) => {
    await clickMatrixCell(page, "A2");
    await typeIntoMatrixCell(page, "world");
    await page.keyboard.press("Tab");

    await expectActiveSelection(page, "B2");
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
