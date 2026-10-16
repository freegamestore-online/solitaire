import { describe, expect, it } from "vitest";
import { drawKlondikeStock } from "./klondike";
import type { Card } from "./cards";

const card = (value: Card["value"]): Card => ({ value, suit: "spades", faceUp: true });

describe("Klondike stock", () => {
  it("recycles the waste so its former top card is drawn first", () => {
    const waste = [card("3"), card("2"), card("A")];
    const recycled = drawKlondikeStock([], waste, 1)!;

    expect(recycled.stock.map((item) => item.value)).toEqual(["3", "2", "A"]);
    expect(recycled.stock.every((item) => !item.faceUp)).toBe(true);
    const firstDraw = drawKlondikeStock(recycled.stock, recycled.waste, 1)!;
    expect(firstDraw.waste.map((item) => item.value)).toEqual(["A"]);
  });

  it("returns no move when both piles are empty", () => {
    expect(drawKlondikeStock([], [], 1)).toBeNull();
  });

  it("draws at most the requested count from the stock", () => {
    const result = drawKlondikeStock([card("A"), card("2")], [], 3)!;
    expect(result.stock).toEqual([]);
    expect(result.waste.map((item) => item.value)).toEqual(["2", "A"]);
  });
});
