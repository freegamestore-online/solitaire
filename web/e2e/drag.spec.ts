import { expect, test } from "@playwright/test";
import { createDeck, isRed, shuffleDeck, valueIndex } from "../src/lib/cards";
import { seededRandom } from "../src/lib/random";
import { collectConsoleErrors, playNumberedDeal, stubExternalServices } from "./helpers";

function findVisibleMove() {
  for (let deal = 1; deal <= 32000; deal++) {
    const deck = shuffleDeck(createDeck(), seededRandom(deal));
    const columns = Array.from({ length: 7 }, (_, column) => {
      const cards = deck.slice(column * (column + 1) / 2, (column + 1) * (column + 2) / 2);
      return cards.map((card, index) => ({ ...card, faceUp: index === cards.length - 1 }));
    });
    for (let from = 0; from < 4; from++) {
      const card = columns[from]!.at(-1)!;
      for (let to = 0; to < 4; to++) {
        if (from === to) continue;
        const top = columns[to]!.at(-1)!;
        if (isRed(card.suit) !== isRed(top.suit) && valueIndex(card.value) === valueIndex(top.value) - 1) {
          return { deal, source: `${card.value}-${card.suit}`, target: `${top.value}-${top.suit}` };
        }
      }
    }
  }
  throw new Error("No visible Klondike tableau move found in the supported deal range");
}

test("Klondike supports dragging a legal tableau move", async ({ page }) => {
  await stubExternalServices(page);
  const consoleErrors = collectConsoleErrors(page);
  const move = findVisibleMove();
  await page.goto("/");
  await playNumberedDeal(page, "Klondike", move.deal);
  const source = page.locator(`[data-card="${move.source}"]`);
  const target = page.locator(`[data-card="${move.target}"]`);
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await source.dragTo(target);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  expect(consoleErrors).toEqual([]);
});
