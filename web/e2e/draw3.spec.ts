import { expect, test } from "@playwright/test";
import { captureReference, stubExternalServices } from "./helpers";

test("Klondike switches between Draw 1 and Draw 3", async ({ page }, testInfo) => {
  await stubExternalServices(page);
  await page.goto("/");

  const draw1 = page.getByRole("button", { name: "Draw 1", exact: true });
  const draw3 = page.getByRole("button", { name: "Draw 3", exact: true });
  await expect(draw1).toBeVisible();
  await expect(draw3).toBeVisible();
  await expect(draw1).toHaveAttribute("aria-pressed", "true");

  await draw3.click();
  await expect(draw3).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("stock-pile").click();
  await expect(page.getByTestId("waste-card")).toHaveCount(3);

  await draw1.click();
  await expect(draw1).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("stock-pile").click();
  await expect(page.getByTestId("waste-card")).toHaveCount(1);

  await page.reload();
  await expect(draw1).toHaveAttribute("aria-pressed", "true");
  await draw3.click();
  await page.getByTestId("stock-pile").click();
  await expect(page.getByTestId("waste-card")).toHaveCount(3);
  await captureReference(page, testInfo, "klondike-draw-3");
});
