import { valueIndex, type Card, type Suit } from "./cards";

/** Whether a card can be placed on the foundation assigned to `suit`. */
export function canPlaceKlondikeFoundation(card: Card, pile: Card[], suit: Suit): boolean {
  if (card.suit !== suit) return false;
  if (pile.length === 0) return card.value === "A";
  const top = pile[pile.length - 1]!;
  return top.suit === suit && valueIndex(card.value) === valueIndex(top.value) + 1;
}

export interface KlondikePiles {
  stock: Card[];
  waste: Card[];
}

/** Draw from the stock, recycle the waste with its current top first, or return null when both are empty. */
export function drawKlondikeStock(stock: Card[], waste: Card[], drawCount: number): KlondikePiles | null {
  if (stock.length === 0) {
    if (waste.length === 0) return null;
    return { stock: waste.map((card) => ({ ...card, faceUp: false })), waste: [] };
  }

  const nextStock = stock.slice();
  const nextWaste = waste.slice();
  const count = Math.min(Math.max(0, drawCount), nextStock.length);
  for (let i = 0; i < count; i++) {
    const card = nextStock.pop()!;
    nextWaste.push({ ...card, faceUp: true });
  }
  return { stock: nextStock, waste: nextWaste };
}
