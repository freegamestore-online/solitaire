import { SUITS, valueIndex, isRed, type Card, type Suit } from "./cards";

/** Deal numbers run from 1 to 32000, as in the classic numbered deals. */
export const MAX_DEAL = 32000;
export const CASCADES = 8;
export const FREE_CELLS = 4;

export interface FreeCellState {
  /** 8 columns, bottom card first. All cards are face up. */
  cascades: Card[][];
  /** 4 cells, each holding one card or empty. */
  freeCells: (Card | null)[];
  /** One pile per suit, in SUITS order. Each pile is built Ace upward. */
  foundations: Card[][];
}

export type Source = { type: "cascade"; col: number; index: number } | { type: "free"; cell: number };
export type Target = { type: "cascade"; col: number } | { type: "free"; cell: number } | { type: "foundation"; pile: number };

/** Linear congruential generator used by the classic numbered deals. Returns 15-bit values. */
export function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 214013) + 2531011) >>> 0;
    return ((s & 0x7fffffff) >> 16) & 0x7fff;
  };
}

const rankOf = (card: Card): number => valueIndex(card.value);

/**
 * Deal a numbered game. The 52 cards are taken in clubs, diamonds, hearts, spades
 * order, shuffled with the generator above, then dealt to the eight columns in turn.
 * Columns 1–4 get 7 cards and columns 5–8 get 6.
 */
export function dealFreeCell(dealNumber: number): FreeCellState {
  const order: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
  const deck: Card[] = [];
  for (const suit of order) {
    for (const value of ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const) {
      deck.push({ suit, value, faceUp: true });
    }
  }
  const rand = makeRand(dealNumber);
  for (let i = 51; i >= 1; i--) {
    const j = rand() % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const cascades: Card[][] = Array.from({ length: CASCADES }, () => []);
  deck.forEach((card, k) => cascades[k % CASCADES]!.push(card));
  return { cascades, freeCells: Array(FREE_CELLS).fill(null), foundations: SUITS.map(() => []) };
}

/** A random deal number, so an unplayed game can still be shared by number. */
export function randomDealNumber(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * MAX_DEAL);
}

/**
 * True when cards from `index` to the bottom of the column form a sequence: each card
 * one rank below the card above it, in the opposite colour.
 */
export function isSequenceFrom(column: Card[], index: number): boolean {
  if (index < 0 || index >= column.length) return false;
  for (let i = index; i < column.length - 1; i++) {
    const above = column[i]!;
    const below = column[i + 1]!;
    if (isRed(above.suit) === isRed(below.suit) || rankOf(below) !== rankOf(above) - 1) return false;
  }
  return true;
}

/**
 * The most cards that can move at once: (1 + empty free cells) × 2^(empty columns).
 * A destination column that is empty does not count, since the cards are going into it.
 */
export function maxSupermove(state: FreeCellState, destinationIsEmpty: boolean): number {
  const emptyCells = state.freeCells.filter((c) => c === null).length;
  let emptyColumns = state.cascades.filter((c) => c.length === 0).length;
  if (destinationIsEmpty) emptyColumns -= 1;
  return (1 + emptyCells) * 2 ** emptyColumns;
}

function cardsAt(state: FreeCellState, source: Source): Card[] | null {
  if (source.type === "free") {
    const card = state.freeCells[source.cell];
    return card ? [card] : null;
  }
  const column = state.cascades[source.col];
  if (!column || !isSequenceFrom(column, source.index)) return null;
  return column.slice(source.index);
}

function canEnterFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return rankOf(card) === 0;
  const top = pile[pile.length - 1]!;
  return top.suit === card.suit && rankOf(card) === rankOf(top) + 1;
}

/**
 * Whether a card can go to its foundation without stranding a card that is still needed.
 * Aces and twos always can. Otherwise both foundations of the opposite colour must
 * already hold the card one rank below.
 */
export function isSafeToFoundation(state: FreeCellState, card: Card): boolean {
  const r = rankOf(card);
  if (r <= 1) return true;
  return state.foundations.every((pile, i) => {
    const suit = SUITS[i]!;
    if (isRed(suit) === isRed(card.suit)) return true;
    return pile.length >= r;
  });
}

/**
 * Move cards from `source` to `target`. Returns the new state, or null when the move
 * is illegal. A legal move is followed by auto-move: any card that is safe goes to its
 * foundation, repeatedly, until none can.
 */
export function moveCards(state: FreeCellState, source: Source, target: Target): FreeCellState | null {
  const moving = cardsAt(state, source);
  if (!moving) return null;
  const lead = moving[0]!;

  if (target.type === "cascade") {
    if (source.type === "cascade" && source.col === target.col) return null;
    const column = state.cascades[target.col];
    if (!column) return null;
    const empty = column.length === 0;
    if (!empty) {
      const top = column[column.length - 1]!;
      if (isRed(top.suit) === isRed(lead.suit) || rankOf(top) !== rankOf(lead) + 1) return null;
    }
    if (moving.length > maxSupermove(state, empty)) return null;
  } else if (target.type === "free") {
    if (moving.length !== 1 || state.freeCells[target.cell] !== null) return null;
    if (source.type === "free" && source.cell === target.cell) return null;
  } else {
    if (moving.length !== 1) return null;
    if (!canEnterFoundation(lead, state.foundations[target.pile] ?? [])) return null;
  }

  const next: FreeCellState = {
    cascades: state.cascades.map((c) => c.slice()),
    freeCells: state.freeCells.slice(),
    foundations: state.foundations.map((p) => p.slice()),
  };
  if (source.type === "cascade") next.cascades[source.col] = next.cascades[source.col]!.slice(0, source.index);
  else next.freeCells[source.cell] = null;

  if (target.type === "cascade") next.cascades[target.col]!.push(...moving);
  else if (target.type === "free") next.freeCells[target.cell] = lead;
  else next.foundations[target.pile]!.push(lead);

  return autoMove(next);
}

/** Repeatedly move any safe top card (cascade or free cell) to its foundation. */
export function autoMove(state: FreeCellState): FreeCellState {
  let current = state;
  for (;;) {
    let moved = false;
    const candidates: { card: Card; from: Source }[] = [];
    current.cascades.forEach((column, col) => {
      const top = column[column.length - 1];
      if (top) candidates.push({ card: top, from: { type: "cascade", col, index: column.length - 1 } });
    });
    current.freeCells.forEach((card, cell) => {
      if (card) candidates.push({ card, from: { type: "free", cell } });
    });
    for (const { card, from } of candidates) {
      const pile = SUITS.indexOf(card.suit);
      if (!canEnterFoundation(card, current.foundations[pile]!) || !isSafeToFoundation(current, card)) continue;
      const next = removeAndPlace(current, from, pile);
      current = next;
      moved = true;
      break;
    }
    if (!moved) return current;
  }
}

function removeAndPlace(state: FreeCellState, from: Source, pile: number): FreeCellState {
  const cascades = state.cascades.map((c) => c.slice());
  const freeCells = state.freeCells.slice();
  const foundations = state.foundations.map((p) => p.slice());
  let card: Card;
  if (from.type === "cascade") {
    card = cascades[from.col]!.pop()!;
  } else {
    card = freeCells[from.cell]!;
    freeCells[from.cell] = null;
  }
  foundations[pile]!.push(card);
  return { cascades, freeCells, foundations };
}

export function isFreeCellWon(state: FreeCellState): boolean {
  return state.foundations.every((p) => p.length === 13);
}
