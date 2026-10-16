import { describe, it, expect } from "vitest";
import { SUITS, VALUES, type Card, type Suit, type Value } from "./cards";
import {
  CASCADES,
  FREE_CELLS,
  MAX_DEAL,
  autoMove,
  dealFreeCell,
  isFreeCellWon,
  isSafeToFoundation,
  isSequenceFrom,
  makeRand,
  maxSupermove,
  moveCards,
  randomDealNumber,
  type FreeCellState,
} from "./freecell";

const c = (value: Value, suit: Suit): Card => ({ value, suit, faceUp: true });

/** Short card code in the published style: rank then suit letter, e.g. JD, 6S. */
const SUIT_LETTER: Record<Suit, string> = { clubs: "C", diamonds: "D", hearts: "H", spades: "S" };
const code = (card: Card): string => `${card.value}${SUIT_LETTER[card.suit]}`;

function empty(): FreeCellState {
  return {
    cascades: Array.from({ length: CASCADES }, () => []),
    freeCells: Array(FREE_CELLS).fill(null),
    foundations: SUITS.map(() => []),
  };
}

describe("deal generator", () => {
  it("runs the linear congruential generator (seed 1 gives 41 first)", () => {
    // 1 * 214013 + 2531011 = 2745024; (2745024 >> 16) & 0x7fff = 41.
    expect(makeRand(1)()).toBe(41);
  });

  it("deals all 52 cards exactly once", () => {
    const s = dealFreeCell(1);
    const cards = s.cascades.flat();
    expect(cards).toHaveLength(52);
    const keys = new Set(cards.map((card) => `${card.value}${card.suit}`));
    expect(keys.size).toBe(52);
  });

  it("deals 7 cards to each of the first four columns and 6 to the last four", () => {
    const s = dealFreeCell(617);
    expect(s.cascades.map((col) => col.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
  });

  it("starts with empty free cells and empty foundations", () => {
    const s = dealFreeCell(42);
    expect(s.freeCells).toEqual([null, null, null, null]);
    expect(s.foundations.every((p) => p.length === 0)).toBe(true);
  });

  it("gives the same deal for the same number, and different deals for different numbers", () => {
    expect(dealFreeCell(7)).toEqual(dealFreeCell(7));
    expect(dealFreeCell(7)).not.toEqual(dealFreeCell(8));
  });

  it("keeps random deal numbers in the 1–32000 range", () => {
    for (const r of [0, 0.5, 0.999999]) {
      const n = randomDealNumber(() => r);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(MAX_DEAL);
    }
  });

  it("deals Game #1 with the published first row (JD 2D 9H JC 5D 7H 7C 5H)", () => {
    // Source: Rosetta Code, "Deal cards for FreeCell". The first eight dealt cards are the
    // top card of each column, left to right.
    const s = dealFreeCell(1);
    expect(s.cascades.map((col) => code(col[0]!))).toEqual(["JD", "2D", "9H", "JC", "5D", "7H", "7C", "5H"]);
  });

  it("deals Game #1 with the published last row (6S 9C 2H 6H)", () => {
    // The last row of the published table is the bottom card of the four 7-card columns.
    const s = dealFreeCell(1);
    expect(s.cascades.slice(0, 4).map((col) => code(col[col.length - 1]!))).toEqual(["6S", "9C", "2H", "6H"]);
  });

  it("gives the same cards in the same order for every deal number, shuffled deterministically", () => {
    const a = dealFreeCell(617).cascades.map((col) => col.map(code));
    const b = dealFreeCell(617).cascades.map((col) => col.map(code));
    expect(a).toEqual(b);
  });

  });

describe("sequence and supermove rules", () => {
  it("accepts alternating colours, each one rank lower", () => {
    const column = [c("Q", "hearts"), c("J", "clubs"), c("10", "hearts")];
    expect(isSequenceFrom(column, 0)).toBe(true);
  });

  it("rejects a same-colour pair even when ranks descend", () => {
    expect(isSequenceFrom([c("Q", "hearts"), c("J", "diamonds")], 0)).toBe(false);
  });

  it("computes (1 + empty cells) × 2^(empty columns)", () => {
    const s = empty();
    s.cascades[0] = [c("K", "clubs")];
    expect(maxSupermove(s, false)).toBe(5 * 2 ** 7);
    s.freeCells = [c("2", "hearts"), c("3", "hearts"), null, null];
    expect(maxSupermove(s, false)).toBe(3 * 2 ** 7);
  });

  it("does not count the destination when it is an empty column", () => {
    const s = empty();
    s.cascades[0] = [c("K", "clubs")];
    expect(maxSupermove(s, true)).toBe(5 * 2 ** 6);
  });
});

describe("moving cards", () => {
  it("moves a single card onto a card one rank higher of the opposite colour", () => {
    const s = empty();
    s.cascades[0] = [c("9", "spades")];
    s.cascades[1] = [c("10", "hearts")];
    const next = moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "cascade", col: 1 })!;
    expect(next.cascades[1]!.map((x) => x.value)).toEqual(["10", "9"]);
  });

  it("rejects a same-colour drop", () => {
    const s = empty();
    s.cascades[0] = [c("9", "spades")];
    s.cascades[1] = [c("10", "clubs")];
    expect(moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "cascade", col: 1 })).toBeNull();
  });

  it("rejects a run longer than the supermove limit", () => {
    // Three free cells are full and no column is empty: the limit is 2 cards.
    // A run of 3 (J clubs, 10 hearts, 9 clubs) lands legally on a Q hearts, so only the limit can stop it.
    const s = empty();
    s.freeCells = [c("A", "hearts"), c("A", "diamonds"), c("A", "clubs"), null];
    s.cascades[0] = [c("J", "clubs"), c("10", "hearts"), c("9", "clubs")];
    s.cascades[1] = [c("Q", "hearts")];
    for (let i = 2; i < CASCADES; i++) s.cascades[i] = [c("2", "spades")];
    expect(moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "cascade", col: 1 })).toBeNull();
  });

  it("moves a run that fits the supermove limit", () => {
    // Same setup, but a run of 2 fits the limit.
    const s = empty();
    s.freeCells = [c("A", "hearts"), c("A", "diamonds"), c("A", "clubs"), null];
    s.cascades[0] = [c("10", "hearts"), c("9", "clubs")];
    s.cascades[1] = [c("J", "clubs")];
    for (let i = 2; i < CASCADES; i++) s.cascades[i] = [c("2", "spades")];
    const next = moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "cascade", col: 1 });
    expect(next).not.toBeNull();
    expect(next!.cascades[1]!.map((x) => x.value)).toEqual(["J", "10", "9"]);
  });

  it("moves a single card into an empty free cell, but not a run", () => {
    const s = empty();
    s.cascades[0] = [c("Q", "hearts"), c("J", "clubs")];
    expect(moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "free", cell: 0 })).toBeNull();
    const next = moveCards(s, { type: "cascade", col: 0, index: 1 }, { type: "free", cell: 0 })!;
    expect(next.freeCells[0]).toMatchObject({ value: "J", suit: "clubs" });
  });

  it("refuses a free cell that is already full", () => {
    const s = empty();
    s.freeCells[0] = c("2", "hearts");
    s.cascades[0] = [c("3", "clubs")];
    expect(moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "free", cell: 0 })).toBeNull();
  });

  it("refuses a card that is not the next rank for its foundation", () => {
    const s = empty();
    s.cascades[0] = [c("3", "hearts")];
    expect(moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "foundation", pile: 0 })).toBeNull();
  });
});

describe("auto-move", () => {
  it("moves a card to its foundation after a move when it is safe", () => {
    const s = empty();
    s.cascades[0] = [c("A", "hearts")];
    const next = moveCards(s, { type: "cascade", col: 0, index: 0 }, { type: "free", cell: 0 });
    expect(next!.foundations[SUITS.indexOf("hearts")]!.map((x) => x.value)).toEqual(["A"]);
    expect(next!.freeCells[0]).toBeNull();
  });

  it("holds a three back until both opposite-colour twos are on foundation", () => {
    const s = empty();
    s.foundations[SUITS.indexOf("hearts")] = [c("A", "hearts"), c("2", "hearts")];
    s.cascades[0] = [c("3", "hearts")];
    expect(isSafeToFoundation(s, c("3", "hearts"))).toBe(false);
    s.foundations[SUITS.indexOf("clubs")] = [c("A", "clubs"), c("2", "clubs")];
    s.foundations[SUITS.indexOf("spades")] = [c("A", "spades"), c("2", "spades")];
    expect(isSafeToFoundation(s, c("3", "hearts"))).toBe(true);
    expect(autoMove(s).foundations[SUITS.indexOf("hearts")]!.length).toBe(3);
  });

  it("does not move a card that is still needed as a support", () => {
    const s = empty();
    s.cascades[0] = [c("4", "clubs")];
    s.foundations[SUITS.indexOf("hearts")] = [c("A", "hearts")];
    expect(autoMove(s).cascades[0]!.length).toBe(1);
  });
});

describe("win condition", () => {
  it("is won when all four foundations hold 13 cards", () => {
    const s = empty();
    for (let i = 0; i < 4; i++) {
      s.foundations[i] = VALUES.map((v) => c(v, SUITS[i]!));
    }
    expect(isFreeCellWon(s)).toBe(true);
    s.foundations[0]!.pop();
    expect(isFreeCellWon(s)).toBe(false);
  });
});
