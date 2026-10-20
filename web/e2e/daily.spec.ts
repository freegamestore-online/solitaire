import { expect, test } from "@playwright/test";
import { captureReference, stubExternalServices } from "./helpers";

test("opens the UTC daily Klondike deal for the selected draw mode", async ({ page }, testInfo) => {
  await stubExternalServices(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Draw 3", exact: true }).click();
  await page.getByRole("button", { name: "Today's deal" }).click();
  await expect(page.getByText(/Daily deal, \d{4}-\d{2}-\d{2} \(UTC\)/)).toBeVisible();
  await expect(page.getByTestId("daily-result")).toContainText("Streak 0 (best 0)");
  await expect(page.getByTestId("stock-pile")).toBeVisible();
  await expect(page.getByRole("button", { name: "Draw 3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await captureReference(page, testInfo, "daily-klondike-draw-3");
});
