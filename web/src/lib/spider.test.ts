import { describe, it, expect } from "vitest";
import { VALUES, type Suit, type Value } from "./cards";
import {
  COLUMNS,
  RUNS_TO_WIN,
  buildSpiderDeck,
  canDropOn,
  completedRunStart,
  dealFromStock,
  dealSpider,
  isRunFrom,
  isSpiderWon,
  moveRun,
  newSpiderGame,
  suitsFor,
  type SpiderCard,
  type SpiderState,
} from "./spider";

let nextUid = 1000;
const card = (value: Value, suit: Suit, faceUp = true): SpiderCard => ({ value, suit, faceUp, uid: nextUid++ });

/** A face-up K-to-A run of one suit, top card first. */
const fullRun = (suit: Suit): SpiderCard[] => [...VALUES].reverse().map((v) => card(v, suit));

/** A face-up King-to-Two run of one suit, top card first. The Ace completes it. */
const kingToTwo = (suit: Suit): SpiderCard[] => [...VALUES].reverse().slice(0, 12).map((v) => card(v, suit));

/** A 10-column board with the given columns filled and the rest empty. */
function board(cols: Record<number, SpiderCard[]>): SpiderCard[][] {
  return Array.from({ length: COLUMNS }, (_, i) => cols[i] ?? []);
}

function state(tableau: SpiderCard[][], stock: SpiderCard[] = [], completed = 0): SpiderState {
  return { tableau, stock, completed };
}

describe("Spider deck", () => {
  it.each([1, 2, 4] as const)("builds two decks (104 cards) for %i suit(s)", (count) => {
    const deck = buildSpiderDeck(count);
    expect(deck).toHaveLength(104);
    expect(new Set(deck.map((c) => c.uid)).size).toBe(104);
  });

  it("uses only the chosen suits, with 8 copies of each rank spread across them", () => {
    const one = buildSpiderDeck(1);
    expect(new Set(one.map((c) => c.suit))).toEqual(new Set(["spades"]));
    expect(one.filter((c) => c.value === "K")).toHaveLength(8);

    const two = buildSpiderDeck(2);
    expect(new Set(two.map((c) => c.suit))).toEqual(new Set(["spades", "hearts"]));
    expect(two.filter((c) => c.suit === "spades" && c.value === "K")).toHaveLength(4);

    const four = buildSpiderDeck(4);
    expect(new Set(four.map((c) => c.suit))).toEqual(new Set(suitsFor(4)));
    expect(four.filter((c) => c.suit === "clubs" && c.value === "A")).toHaveLength(2);
  });
});

describe("dealing", () => {
  it("deals 6 cards to each of the first four columns and 5 to the rest", () => {
    const s = dealSpider(buildSpiderDeck(4));
    expect(s.tableau.map((c) => c.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(s.stock).toHaveLength(50);
    expect(s.completed).toBe(0);
  });

  it("shows only the top card of each column face up", () => {
    const s = newSpiderGame(2);
    for (const col of s.tableau) {
      col.forEach((c, i) => expect(c.faceUp).toBe(i === col.length - 1));
    }
    expect(s.stock.every((c) => !c.faceUp)).toBe(true);
  });
});

describe("stacking and run rules", () => {
  it("accepts any suit when one rank lower, in any column", () => {
    expect(canDropOn(card("9", "hearts"), [card("10", "clubs")])).toBe(true);
    expect(canDropOn(card("9", "hearts"), [card("10", "spades")])).toBe(true);
  });

  it("rejects the same rank or a rank two apart", () => {
    expect(canDropOn(card("9", "hearts"), [card("9", "clubs")])).toBe(false);
    expect(canDropOn(card("9", "hearts"), [card("J", "clubs")])).toBe(false);
  });

  it("rejects a drop onto a face-down top card", () => {
    expect(canDropOn(card("9", "hearts"), [card("10", "clubs", false)])).toBe(false);
  });

  it("accepts any card onto an empty column", () => {
    expect(canDropOn(card("4", "diamonds"), [])).toBe(true);
  });

  it("treats a descending run as movable in mixed suits", () => {
    const column = [card("Q", "hearts"), card("J", "clubs"), card("10", "spades")];
    expect(isRunFrom(column, 0)).toBe(true);
    expect(isRunFrom(column, 1)).toBe(true);
  });

  it("does not treat a broken sequence as a run", () => {
    const column = [card("Q", "hearts"), card("9", "clubs"), card("8", "spades")];
    expect(isRunFrom(column, 0)).toBe(false);
    expect(isRunFrom(column, 1)).toBe(true);
    expect(isRunFrom([card("9", "clubs"), card("10", "spades")], 0)).toBe(false);
  });

  it("does not move a face-down card or a run that includes one", () => {
    expect(isRunFrom([card("9", "hearts", false)], 0)).toBe(false);
    expect(isRunFrom([card("10", "hearts", false), card("9", "clubs")], 0)).toBe(false);
  });
});

describe("moveRun", () => {
  it("moves a single card onto a column with a card one rank higher, any suit", () => {
    const s = state(board({ 0: [card("Q", "clubs")], 1: [card("J", "hearts")] }));
    const next = moveRun(s, 1, 0, 0)!;
    expect(next.tableau[0]!.map((c) => c.value)).toEqual(["Q", "J"]);
    expect(next.tableau[1]).toEqual([]);
  });

  it("moves a whole mixed-suit run as a unit", () => {
    const s = state(board({ 0: [card("K", "clubs")], 1: [card("Q", "hearts"), card("J", "spades")] }));
    const next = moveRun(s, 1, 0, 0)!;
    expect(next.tableau[0]!.map((c) => c.value)).toEqual(["K", "Q", "J"]);
  });

  it("turns over the card a move uncovers", () => {
    const s = state(board({ 0: [card("7", "clubs")], 1: [card("7", "hearts", false), card("6", "spades")] }));
    const next = moveRun(s, 1, 1, 0)!;
    expect(next.tableau[1]!.map((c) => c.faceUp)).toEqual([true]);
  });

  it("moves any card into an empty column", () => {
    const s = state(board({ 0: [card("4", "diamonds")] }));
    const next = moveRun(s, 0, 0, 5)!;
    expect(next.tableau[5]!.map((c) => c.value)).toEqual(["4"]);
    expect(next.tableau[0]).toEqual([]);
  });

  it("refuses an illegal drop and leaves the state alone", () => {
    const s = state(board({ 0: [card("K", "clubs")], 1: [card("5", "hearts")] }));
    expect(moveRun(s, 1, 0, 0)).toBeNull();
  });

  it("refuses to move a broken sequence", () => {
    const s = state(board({ 0: [card("K", "clubs")], 1: [card("Q", "hearts"), card("9", "spades")] }));
    expect(moveRun(s, 1, 0, 0)).toBeNull();
  });

  it("refuses to move onto the same column", () => {
    const s = state(board({ 0: [card("K", "clubs"), card("Q", "hearts")] }));
    expect(moveRun(s, 0, 1, 0)).toBeNull();
  });
});

describe("complete runs", () => {
  it("finds a King-to-Ace same-suit run at the bottom of a column", () => {
    expect(completedRunStart(fullRun("spades"))).toBe(0);
    expect(completedRunStart([card("7", "hearts", false), ...fullRun("spades")])).toBe(1);
  });

  it("does not count a run with mixed suits", () => {
    const column = fullRun("spades");
    column[5] = card(column[5]!.value, "hearts");
    expect(completedRunStart(column)).toBe(-1);
  });

  it("removes a completed run and counts it, revealing the card beneath", () => {
    const s = state(
      board({
        0: [card("7", "hearts", false), ...kingToTwo("spades")],
        1: [card("A", "spades")],
      }),
    );
    const next = moveRun(s, 1, 0, 0)!;
    expect(next.completed).toBe(1);
    expect(next.tableau[0]).toHaveLength(1);
    expect(next.tableau[0]![0]).toMatchObject({ value: "7", suit: "hearts", faceUp: true });
  });

  it("does not remove a King-to-Ace run in mixed suits", () => {
    const column = kingToTwo("spades");
    column[3] = card("10", "hearts");
    const s = state(board({ 0: column, 1: [card("A", "spades")] }));
    const next = moveRun(s, 1, 0, 0)!;
    expect(next.completed).toBe(0);
    expect(next.tableau[0]).toHaveLength(13);
  });
});

describe("dealing from stock", () => {
  it("deals one face-up card to each of the ten columns", () => {
    const s = state(
      board(Object.fromEntries(Array.from({ length: COLUMNS }, (_, i) => [i, [card("K", "clubs", false)]]))),
      Array.from({ length: 20 }, () => card("2", "hearts", false)),
    );
    const next = dealFromStock(s)!;
    expect(next.stock).toHaveLength(10);
    next.tableau.forEach((col) => {
      expect(col).toHaveLength(2);
      expect(col[1]!.faceUp).toBe(true);
    });
  });

  it("is refused while any column is empty", () => {
    const s = state(board({ 0: [card("K", "clubs")] }), Array.from({ length: 10 }, () => card("2", "hearts", false)));
    expect(dealFromStock(s)).toBeNull();
  });

  it("is refused when the stock is empty", () => {
    const full = board(Object.fromEntries(Array.from({ length: COLUMNS }, (_, i) => [i, [card("K", "clubs")]])));
    expect(dealFromStock(state(full, []))).toBeNull();
  });

  it("can complete a run, which is removed straight after the deal", () => {
    const beneath = kingToTwo("spades");
    const stock = Array.from({ length: 10 }, (_, i) => (i === 0 ? card("A", "spades", false) : card("3", "clubs", false)));
    const cols: Record<number, SpiderCard[]> = { 0: beneath };
    for (let i = 1; i < COLUMNS; i++) cols[i] = [card("K", "clubs")];
    const next = dealFromStock(state(board(cols), stock))!;
    expect(next.completed).toBe(1);
  });
});

describe("win condition", () => {
  it("is won once all eight runs are removed", () => {
    expect(RUNS_TO_WIN).toBe(8);
    expect(isSpiderWon(state(board({}), [], 8))).toBe(true);
    expect(isSpiderWon(state(board({}), [], 7))).toBe(false);
  });
});
