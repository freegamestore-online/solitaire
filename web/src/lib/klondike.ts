import type { Card } from "./cards";

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
