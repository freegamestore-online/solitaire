import { expect, test } from "@playwright/test";
import { cardId } from "../src/lib/cards";
import { dealTriPeaks, triPeaksPuzzle, type TriPeaksMove, type TriPeaksState } from "../src/lib/tripeaks";
import { collectConsoleErrors, playNumberedDeal, stubExternalServices } from "./helpers";

function winningLine(start: TriPeaksState): TriPeaksMove[] {
  const seen = new Set<string>();
  let visited = 0;
  const visit = (state: TriPeaksState): TriPeaksMove[] | null => {
    if (triPeaksPuzzle.won(state)) return [];
    const key = triPeaksPuzzle.key(state);
    if (seen.has(key) || ++visited > 20_000) return null;
    seen.add(key);
    for (const move of triPeaksPuzzle.moves(state)) {
      const next = triPeaksPuzzle.apply(state, move);
      const tail = visit(next);
      if (tail) return [move, ...tail];
    }
    return null;
  };
  const line = visit(start);
  if (!line) throw new Error("The selected TriPeaks deal did not solve within the app's search budget");
  return line;
}

test("a deterministic TriPeaks deal can be played to a win and updates stats", async ({ page }, testInfo) => {
  await stubExternalServices(page);
  const consoleErrors = collectConsoleErrors(page);
  await page.goto("/");
  await playNumberedDeal(page, "TriPeaks", 1);
  const dealLabel = page.locator('label[for="deal-number"]');
  await expect(dealLabel).toContainText("Deal #");
  const dealNumber = Number((await dealLabel.innerText()).match(/#(\d+)/)?.[1]);
  expect(dealNumber).toBeGreaterThan(0);

  let state = dealTriPeaks(dealNumber);
  for (const move of winningLine(state)) {
    if (move.type === "draw") {
      await page.getByTestId("stock-pile").click();
    } else {
      const card = state.tableau[move.i]!;
      await page.locator(`[data-card="${cardId(card)}"]`).click();
    }
    state = triPeaksPuzzle.apply(state, move);
  }

  await expect(page.getByText(/You Won! Score:/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".stats-line")).toContainText("Won 1");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("tripeaks-win.png"), animations: "disabled" });
  expect(consoleErrors).toEqual([]);
});
