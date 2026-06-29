import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

test.describe("context-canvas accessibility", () => {
  test("first screen has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("matrix-shell")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const blockingViolations = results.violations.filter((violation) =>
      violation.impact ? BLOCKING_IMPACTS.has(violation.impact) : false,
    );

    expect(
      blockingViolations,
      blockingViolations.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
    ).toEqual([]);
  });
});
