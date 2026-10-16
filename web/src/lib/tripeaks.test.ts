import { describe, it, expect } from "vitest";
import { SUITS, type Card, type Value } from "./cards";
import {
  PEAK_COVERS,
  TRIPEAKS_SIZE,
  applyTriPeaks,
  dealTriPeaks,
  isNeighbour,
  isPeakAvailable,
  isTriPeaksWon,
  triPeaksMoves,
  triPeaksPuzzle,
  type TriPeaksState,
} from "./tripeaks";
import { findSolvableDeal, solve } from "./solver";

const c = (value: Value, suit: (typeof SUITS)[number] = "spades"): Card => ({ value, suit, faceUp: true });

/** A TriPeaks state with explicit cards. Everything starts removed except what `live` leaves in place. */
function custom(tableau: Card[], opts: Partial<TriPeaksState> = {}): TriPeaksState {
  return {
    tableau,
    removed: Array(TRIPEAKS_SIZE).fill(false),
    stock: [],
    drawn: 0,
    waste: c("8"),
    streak: 0,
    score: 0,
    ...opts,
  };
}

const sevens = () => Array.from({ length: TRIPEAKS_SIZE }, () => c("7", "clubs"));

describe("TriPeaks layout", () => {
  it("has the three peak tops each covered by two cards below", () => {
    expect(PEAK_COVERS[0]).toHaveLength(2);
    expect(PEAK_COVERS[1]).toHaveLength(2);
    expect(PEAK_COVERS[2]).toHaveLength(2);
  });

  it("leaves the bottom row free at the start", () => {
    const s = dealTriPeaks(1);
    const free = Array.from({ length: TRIPEAKS_SIZE }, (_, i) => i).filter((i) => isPeakAvailable(s, i));
    expect(free).toEqual([18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);
  });

  it("deals 28 peak cards, one waste card and a 23-card stock", () => {
    const s = dealTriPeaks(1);
    expect(s.tableau).toHaveLength(28);
    expect(s.stock).toHaveLength(23);
    expect(s.waste).toBeDefined();
  });
});

describe("TriPeaks rules", () => {
  it("plays a card one rank above or below the waste card", () => {
    const tableau = sevens();
    tableau[25] = c("8", "hearts");
    const next = applyTriPeaks(custom(tableau, { waste: c("7", "diamonds") }), { type: "play", i: 25 });
    expect(next!.waste.value).toBe("8");
    expect(next!.removed[25]).toBe(true);
  });

  it("refuses a card that is not a neighbour of the waste card", () => {
    const tableau = sevens();
    tableau[25] = c("9", "hearts");
    expect(applyTriPeaks(custom(tableau, { waste: c("7", "diamonds") }), { type: "play", i: 25 })).toBeNull();
  });

  it("counts Ace and King as neighbours", () => {
    expect(isNeighbour(c("A"), c("K"))).toBe(true);
    expect(isNeighbour(c("K"), c("A"))).toBe(true);
    expect(isNeighbour(c("2"), c("K"))).toBe(false);
  });

  it("refuses a card that is still covered", () => {
    const tableau = sevens();
    tableau[0] = c("8", "hearts"); // covered by cards 3 and 4 in row 1... still in play
    expect(applyTriPeaks(custom(tableau, { waste: c("7", "diamonds") }), { type: "play", i: 0 })).toBeNull();
  });

  it("turns over the next stock card, and the streak resets", () => {
    const stock = [c("6", "clubs"), c("5", "clubs")];
    const next = applyTriPeaks(custom(sevens(), { stock, streak: 3 }), { type: "draw" })!;
    expect(next.waste.value).toBe("6");
    expect(next.drawn).toBe(1);
    expect(next.streak).toBe(0);
  });

  it("refuses a draw once the stock is used up", () => {
    expect(applyTriPeaks(custom(sevens(), { stock: [], drawn: 0 }), { type: "draw" })).toBeNull();
  });

  it("scores each play, with the streak adding to later plays", () => {
    const tableau = sevens();
    tableau[25] = c("8", "hearts");
    tableau[24] = c("9", "hearts");
    const first = applyTriPeaks(custom(tableau, { waste: c("7", "diamonds") }), { type: "play", i: 25 })!;
    expect(first.score).toBe(10);
    const second = applyTriPeaks(first, { type: "play", i: 24 })!;
    expect(second.score).toBe(30);
  });

  it("is won when every peak card is removed", () => {
    expect(isTriPeaksWon(custom(sevens(), { removed: Array(TRIPEAKS_SIZE).fill(true) }))).toBe(true);
  });

  it("offers a draw while the stock has cards", () => {
    expect(triPeaksMoves(custom(sevens(), { stock: [c("6")] }))).toContainEqual({ type: "draw" });
  });
});

describe("TriPeaks solver", () => {
  it("solves a position where the last card is a neighbour of the waste", () => {
    const tableau = sevens();
    tableau[27] = c("8", "hearts");
    const removed = Array(TRIPEAKS_SIZE).fill(true);
    removed[27] = false;
    expect(solve(custom(tableau, { removed, waste: c("7", "diamonds") }), triPeaksPuzzle)).toBe("solved");
  });

  it("reports a position with no way to win as unsolvable", () => {
    const tableau = sevens();
    const removed = Array(TRIPEAKS_SIZE).fill(true);
    removed[27] = false; // a 7 with no 6 or 8 to play, and the stock used up
    expect(solve(custom(tableau, { removed, waste: c("2", "diamonds"), stock: [], drawn: 0 }), triPeaksPuzzle)).toBe("unsolvable");
  });

  it("finds a solvable numbered deal, and that deal solves", () => {
    const found = findSolvableDeal(1, dealTriPeaks, triPeaksPuzzle, { tries: 20 });
    expect(found).not.toBeNull();
    expect(solve(found!.state, triPeaksPuzzle)).toBe("solved");
  }, 60000);
});
