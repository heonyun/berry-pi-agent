import { expect, test } from "@playwright/test";

test.describe("matrix grid excel interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("matrix-grid")).toBeVisible();
    const onboardingDismiss = page.getByTestId("matrix-onboarding").getByRole("button", {
      name: "Got it",
    });
    if (await onboardingDismiss.isVisible().catch(() => false)) {
      await onboardingDismiss.click();
    }
  });

  test("inline edit, Enter moves down, Tab moves right", async ({ page }) => {
    const grid = page.getByTestId("matrix-grid");
    const box = await grid.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    const cellA1X = box.x + 80;
    const cellA1Y = box.y + 60;

    await page.mouse.click(cellA1X, cellA1Y);
    await page.keyboard.type("hello");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("matrix-status-selection")).toContainText("A2");

    await page.keyboard.type("world");
    await page.keyboard.press("Tab");

    await expect(page.getByTestId("matrix-status-selection")).toContainText("B2");
  });

  test("drag range updates selection summary", async ({ page }) => {
    const grid = page.getByTestId("matrix-grid");
    const box = await grid.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    const startX = box.x + 80;
    const startY = box.y + 60;
    const endX = box.x + 80 + 120 * 2;
    const endY = box.y + 60;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByTestId("matrix-status-selection")).toContainText("A1:C1");
    await expect(page.getByTestId("matrix-status-selection")).toContainText("3×1");
  });
});
