import { describe, expect, it } from "vitest";
import { canPlaceKlondikeFoundation, drawKlondikeStock } from "./klondike";
import type { Card, Suit } from "./cards";

const card = (value: Card["value"], suit: Suit = "spades"): Card => ({ value, suit, faceUp: true });

describe("Klondike foundations", () => {
  it("accepts only the suit assigned to an empty foundation", () => {
    expect(canPlaceKlondikeFoundation(card("A", "spades"), [], "spades")).toBe(true);
    expect(canPlaceKlondikeFoundation(card("A", "spades"), [], "hearts")).toBe(false);
  });

  it("builds the assigned suit upward by one rank", () => {
    expect(canPlaceKlondikeFoundation(card("2", "hearts"), [card("A", "hearts")], "hearts")).toBe(true);
    expect(canPlaceKlondikeFoundation(card("2", "spades"), [card("A", "hearts")], "hearts")).toBe(false);
  });
});

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
