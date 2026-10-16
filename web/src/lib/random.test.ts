import { describe, it, expect } from "vitest";
import { seededRandom } from "./random";
import { createDeck, shuffleDeck } from "./cards";

describe("seeded random", () => {
  it("gives the same sequence for the same seed", () => {
    const a = seededRandom(617);
    const b = seededRandom(617);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays in [0, 1)", () => {
    const r = seededRandom(9);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("gives the same Klondike shuffle for the same seed", () => {
    const one = shuffleDeck(createDeck(), seededRandom(42)).map((c) => `${c.value}${c.suit}`);
    const two = shuffleDeck(createDeck(), seededRandom(42)).map((c) => `${c.value}${c.suit}`);
    expect(one).toEqual(two);
    expect(one).not.toEqual(shuffleDeck(createDeck(), seededRandom(43)).map((c) => `${c.value}${c.suit}`));
  });
});
