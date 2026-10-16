import { valueIndex, type Card } from "./cards";
import { dealDeck } from "./pyramid";
import type { Puzzle } from "./solver";

/**
 * TriPeaks solitaire. Twenty-eight cards form three peaks, with each card covered by the
 * two cards diagonally below it. One card starts face up on the waste pile, and 23 more
 * make the stock. Play a tableau card that is available and whose rank is one above or
 * below the waste card. Ace and King count as neighbours. Drawing turns over the next
 * stock card, and it is the new waste card.
 */
export const TRIPEAKS_SIZE = 28;

/**
 * Peak layout on a half-card grid: each card has a row and an x. Row 0 has the three peak
 * tops, and each row below has the cards whose x sits one away from the row above.
 */
const LAYOUT: { row: number; x: number }[] = [
  ...[2, 8, 14].map((x) => ({ row: 0, x })),
  ...[1, 3, 7, 9, 13, 15].map((x) => ({ row: 1, x })),
  ...[0, 2, 4, 6, 8, 10, 12, 14, 16].map((x) => ({ row: 2, x })),
  ...[1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map((x) => ({ row: 3, x })),
];

/** Position of each tableau card on the half-card grid, for the board. */
export const POSITIONS = LAYOUT;

/** The cards that cover card `i`: the cards one row below, one x-step to either side. */
export const PEAK_COVERS: number[][] = LAYOUT.map(({ row, x }) =>
  LAYOUT.flatMap((other, j) => (other.row === row + 1 && Math.abs(other.x - x) === 1 ? [j] : [])),
);

export interface TriPeaksState {
  tableau: Card[];
  removed: boolean[];
  stock: Card[];
  drawn: number;
  /** The playable waste card. */
  waste: Card;
  streak: number;
  score: number;
}

export type TriPeaksMove = { type: "draw" } | { type: "play"; i: number };

export function dealTriPeaks(dealNumber: number): TriPeaksState {
  const deck = dealDeck(dealNumber);
  return {
    tableau: deck.slice(0, TRIPEAKS_SIZE),
    removed: Array(TRIPEAKS_SIZE).fill(false),
    waste: deck[TRIPEAKS_SIZE]!,
    stock: deck.slice(TRIPEAKS_SIZE + 1),
    drawn: 0,
    streak: 0,
    score: 0,
  };
}

export function isPeakAvailable(state: TriPeaksState, i: number): boolean {
  return !state.removed[i] && PEAK_COVERS[i]!.every((j) => state.removed[j]);
}

/** Ace and King are neighbours, so the ranks wrap around. */
export function isNeighbour(a: Card, b: Card): boolean {
  const d = Math.abs(valueIndex(a.value) - valueIndex(b.value));
  return d === 1 || d === 12;
}

export function applyTriPeaks(state: TriPeaksState, move: TriPeaksMove): TriPeaksState | null {
  if (move.type === "draw") {
    if (state.drawn >= state.stock.length) return null;
    return { ...state, waste: state.stock[state.drawn]!, drawn: state.drawn + 1, streak: 0 };
  }
  const card = state.tableau[move.i];
  if (!card || !isPeakAvailable(state, move.i) || !isNeighbour(card, state.waste)) return null;
  const removed = state.removed.slice();
  removed[move.i] = true;
  return {
    ...state,
    removed,
    waste: card,
    streak: state.streak + 1,
    score: state.score + 10 * (state.streak + 1),
  };
}

export function triPeaksMoves(state: TriPeaksState): TriPeaksMove[] {
  // Plays come before draws, so the solver tries progress before turning cards over.
  const moves: TriPeaksMove[] = [];
  for (let i = 0; i < TRIPEAKS_SIZE; i++) {
    if (applyTriPeaks(state, { type: "play", i })) moves.push({ type: "play", i });
  }
  if (state.drawn < state.stock.length) moves.push({ type: "draw" });
  return moves;
}

export function isTriPeaksWon(state: TriPeaksState): boolean {
  return state.removed.every(Boolean);
}

const code = (c: Card) => `${c.value}${c.suit}`;

export const triPeaksPuzzle: Puzzle<TriPeaksState, TriPeaksMove> = {
  moves: triPeaksMoves,
  apply: (state, move) => applyTriPeaks(state, move) ?? state,
  key: (state) => `${state.removed.map((r) => (r ? "1" : "0")).join("")}|${state.drawn}|${code(state.waste)}`,
  won: isTriPeaksWon,
};
