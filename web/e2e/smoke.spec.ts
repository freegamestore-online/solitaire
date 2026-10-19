import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, captureReference, collectConsoleErrors, playNumberedDeal, stubExternalServices } from "./helpers";

const modes = [
  { name: "Klondike", stock: true },
  { name: "Spider · 1 suit", stock: true },
  { name: "FreeCell", stock: false },
  { name: "TriPeaks", stock: true },
  { name: "Pyramid", stock: true },
];

for (const mode of modes) {
  test(`${mode.name} supports a phone move and undo`, async ({ page }, testInfo) => {
    await stubExternalServices(page);
    const consoleErrors = collectConsoleErrors(page);
    await page.goto("/");
    await playNumberedDeal(page, mode.name, 1);

    const boardCards = page.locator("[data-card]");
    await expect(boardCards.first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const undo = page.getByRole("button", { name: "Undo" });
    if (mode.stock) {
      await page.getByTestId("stock-pile").click();
    } else {
      await page.getByTestId("freecell-source").click();
      await page.getByTestId("free-cell-0").click();
    }
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(undo).toBeDisabled();

    await captureReference(page, testInfo, mode.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"));
    expect(consoleErrors, "browser console errors").toEqual([]);
  });
}

test("leaderboard opens and renders scores", async ({ page }) => {
  await stubExternalServices(page);
  const consoleErrors = collectConsoleErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Leaderboard" }).click();
  const dialog = page.getByRole("dialog", { name: "Klondike leaderboard" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Browser test")).toBeVisible();
  await page.getByRole("button", { name: "Close leaderboard" }).click();
  await expect(dialog).toBeHidden();
  expect(consoleErrors).toEqual([]);
});
