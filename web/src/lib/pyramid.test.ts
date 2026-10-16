import { describe, it, expect } from "vitest";
import { SUITS, type Card, type Value } from "./cards";
import {
  COVERS,
  PYRAMID_SIZE,
  applyPyramid,
  dealPyramid,
  isAvailable,
  isPyramidDead,
  isPyramidWon,
  pyramidMoves,
  pyramidPuzzle,
  type PyramidState,
} from "./pyramid";
import { findSolvableDeal, solve } from "./solver";

const c = (value: Value, suit: (typeof SUITS)[number] = "spades"): Card => ({ value, suit, faceUp: true });

/** A pyramid state with explicit cards. */
function custom(pyramid: Card[], opts: Partial<PyramidState> = {}): PyramidState {
  return {
    pyramid,
    removed: Array(PYRAMID_SIZE).fill(false),
    stock: [],
    waste: [],
    streak: 0,
    score: 0,
    ...opts,
  };
}

/** Pyramid with every card the same rank, so no pair makes 13. */
const twos = () => Array.from({ length: PYRAMID_SIZE }, () => c("2", "clubs"));

describe("Pyramid layout", () => {
  it("has each card covered by the two cards diagonally below it", () => {
    expect(COVERS[0]).toEqual([1, 2]);
    expect(COVERS[27]).toEqual([]);
    expect(COVERS[20]).toEqual([26, 27]);
  });

  it("makes only the bottom row available at the start", () => {
    const s = dealPyramid(1);
    const available = Array.from({ length: PYRAMID_SIZE }, (_, i) => i).filter((i) => isAvailable(s, i));
    expect(available).toEqual([21, 22, 23, 24, 25, 26, 27]);
  });

  it("deals 28 pyramid cards and a 24-card stock", () => {
    const s = dealPyramid(1);
    expect(s.pyramid).toHaveLength(28);
    expect(s.stock).toHaveLength(24);
  });
});

describe("Pyramid rules", () => {
  it("removes a pair that adds up to 13", () => {
    const pyramid = twos();
    pyramid[21] = c("6", "clubs");
    pyramid[22] = c("7", "hearts");
    const next = applyPyramid(custom(pyramid), { type: "pair", a: { type: "pyr", i: 21 }, b: { type: "pyr", i: 22 } });
    expect(next!.removed[21]).toBe(true);
    expect(next!.removed[22]).toBe(true);
  });

  it("refuses a pair that does not add up to 13", () => {
    const pyramid = twos();
    pyramid[21] = c("6", "clubs");
    pyramid[22] = c("8", "hearts");
    expect(applyPyramid(custom(pyramid), { type: "pair", a: { type: "pyr", i: 21 }, b: { type: "pyr", i: 22 } })).toBeNull();
  });

  it("counts Ace as 1, so Ace and Queen pair", () => {
    const pyramid = twos();
    pyramid[21] = c("A", "clubs");
    pyramid[22] = c("Q", "hearts");
    expect(applyPyramid(custom(pyramid), { type: "pair", a: { type: "pyr", i: 21 }, b: { type: "pyr", i: 22 } })).not.toBeNull();
  });

  it("removes a King alone, and refuses a King in a pair", () => {
    const pyramid = twos();
    pyramid[21] = c("K", "hearts");
    pyramid[22] = c("A", "hearts");
    const s = custom(pyramid);
    expect(applyPyramid(s, { type: "king", from: { type: "pyr", i: 21 } })!.removed[21]).toBe(true);
    expect(applyPyramid(s, { type: "pair", a: { type: "pyr", i: 21 }, b: { type: "pyr", i: 22 } })).toBeNull();
  });

  it("refuses to play a card that is still covered", () => {
    const pyramid = twos();
    pyramid[0] = c("K", "hearts");
    expect(applyPyramid(custom(pyramid), { type: "king", from: { type: "pyr", i: 0 } })).toBeNull();
  });

  it("pairs a pyramid card with the waste top", () => {
    const pyramid = twos();
    pyramid[21] = c("4", "clubs");
    const s = custom(pyramid, { waste: [c("9", "diamonds")] });
    const next = applyPyramid(s, { type: "pair", a: { type: "pyr", i: 21 }, b: { type: "waste" } });
    expect(next!.waste).toEqual([]);
    expect(next!.removed[21]).toBe(true);
  });

  it("turns over the next stock card onto the waste", () => {
    const stock = [c("3", "clubs"), c("4", "clubs")];
    const next = applyPyramid(custom(twos(), { stock }), { type: "draw" })!;
    expect(next.waste.map((x) => x.value)).toEqual(["3"]);
    expect(next.stock.map((x) => x.value)).toEqual(["4"]);
  });

  it("recycles the waste into the stock when the stock runs out, with no limit on redeals", () => {
    let s: PyramidState | null = custom(twos(), { stock: [c("3", "clubs")] });
    s = applyPyramid(s!, { type: "draw" });
    expect(s!.stock).toEqual([]);
    s = applyPyramid(s!, { type: "draw" });
    expect(s!.stock.map((x) => x.value)).toEqual(["3"]);
    expect(s!.waste).toEqual([]);
  });

  it("offers no draw when the stock and waste are both empty", () => {
    expect(pyramidMoves(custom(twos()))).not.toContainEqual({ type: "draw" });
  });

  it("scores removals, and the streak resets on a turn-over", () => {
    const pyramid = twos();
    pyramid[21] = c("K", "hearts");
    pyramid[22] = c("6", "clubs");
    pyramid[23] = c("7", "hearts");
    let s: PyramidState | null = custom(pyramid, { stock: [c("2", "diamonds")] });
    s = applyPyramid(s!, { type: "king", from: { type: "pyr", i: 21 } });
    expect(s!.score).toBe(10);
    s = applyPyramid(s!, { type: "pair", a: { type: "pyr", i: 22 }, b: { type: "pyr", i: 23 } });
    expect(s!.score).toBe(30);
    s = applyPyramid(s!, { type: "draw" });
    expect(s!.streak).toBe(0);
  });

  it("is won when the pyramid is clear", () => {
    expect(isPyramidWon(custom(twos(), { removed: Array(PYRAMID_SIZE).fill(true) }))).toBe(true);
  });

  it("is dead when a card has no possible partner left", () => {
    const pyramid = twos(); // every card is a 2, and nothing is a 11
    expect(isPyramidDead(custom(pyramid))).toBe(true);
  });

  it("is not dead while a partner is still in the stock", () => {
    const pyramid = twos();
    pyramid[27] = c("2", "clubs");
    expect(isPyramidDead(custom(pyramid, { stock: [c("J", "hearts")] }))).toBe(false);
  });
});

describe("Pyramid solver", () => {
  it("solves a position with one King left on top", () => {
    const pyramid = twos();
    pyramid[0] = c("K", "hearts");
    const removed = Array(PYRAMID_SIZE).fill(true);
    removed[0] = false;
    expect(solve(custom(pyramid, { removed }), pyramidPuzzle)).toBe("solved");
  });

  it("reports an unwinnable position as unsolvable", () => {
    const pyramid = twos();
    const removed = Array(PYRAMID_SIZE).fill(true);
    removed[0] = false; // a lone 2 can never pair with anything
    expect(solve(custom(pyramid, { removed }), pyramidPuzzle)).toBe("unsolvable");
  });

  it("finds a solvable numbered deal, and that deal solves", () => {
    const found = findSolvableDeal(1, dealPyramid, pyramidPuzzle, { tries: 20 });
    expect(found).not.toBeNull();
    expect(solve(found!.state, pyramidPuzzle)).toBe("solved");
  }, 60000);
});
