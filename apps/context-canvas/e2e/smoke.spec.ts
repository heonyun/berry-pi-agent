import { expect, test } from "@playwright/test";

test.describe("context-canvas smoke", () => {
  test("loads matrix shell with controls and no fatal runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/");

    await expect(page.getByTestId("matrix-shell")).toBeVisible();
    await expect(page.getByTestId("matrix-grid")).toBeVisible();
    await expect(page.getByTestId("matrix-composer")).toBeVisible();
    await expect(page.getByLabel("Recent ranges")).toBeVisible();
    await expect(page.getByLabel("Run history")).toBeVisible();
    await expect(page.getByRole("button", { name: "Canvas" })).toBeVisible();
    await expect(page.getByText("Ready")).toBeVisible();

    expect(pageErrors, `Unexpected page errors: ${pageErrors.join("; ")}`).toEqual([]);
  });

  test("canvas view shows shell and question input after toggle", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Canvas" }).click();

    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.getByLabel("Canvas question input")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Matrix" })).toBeVisible();
    await expect(page.getByText("Ready")).toBeVisible();

    expect(pageErrors, `Unexpected page errors: ${pageErrors.join("; ")}`).toEqual([]);
  });
});
