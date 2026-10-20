import { describe, expect, it } from "vitest";
import { canPlaceKlondikeFoundation, drawKlondikeStock, klondikeRecyclePenalty } from "./klondike";
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

  it("draws up to three cards in Draw 3, including a short final draw", () => {
    const result = drawKlondikeStock([card("A"), card("2"), card("3"), card("4")], [], 3)!;
    expect(result.stock).toHaveLength(1);
    expect(result.waste.map((item) => item.value)).toEqual(["4", "3", "2"]);
    const finalDraw = drawKlondikeStock(result.stock, result.waste, 3)!;
    expect(finalDraw.stock).toHaveLength(0);
    expect(finalDraw.waste.slice(-1).map((item) => item.value)).toEqual(["A"]);
  });

  it("charges 100 points from the second Draw 3 recycle onward", () => {
    expect(klondikeRecyclePenalty(3, 0)).toBe(0);
    expect(klondikeRecyclePenalty(3, 1)).toBe(0);
    expect(klondikeRecyclePenalty(3, 2)).toBe(100);
    expect(klondikeRecyclePenalty(3, 3)).toBe(200);
    expect(klondikeRecyclePenalty(1, 3)).toBe(0);
  });
});
