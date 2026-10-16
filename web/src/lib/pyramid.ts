import { SUITS, VALUES, valueIndex, type Card, type Suit, type Value } from "./cards";
import { makeRand } from "./freecell";
import type { Puzzle } from "./solver";

/**
 * Pyramid solitaire. A 28-card pyramid (rows of 1 to 7), a stock, and a waste pile.
 * Remove pairs that add up to 13 (Ace = 1, Jack 11, Queen 12, King 13). A King is
 * removed alone. A pyramid card can be played once both cards covering it are gone.
 * Each turn-over moves the next stock card to the waste. When the stock runs out, the
 * waste is turned back into the stock, so there is no limit on redeals.
 */
export const PYRAMID_SIZE = 28;
const TARGET = 13;

export interface PyramidState {
  /** The pyramid, row by row from the top. */
  pyramid: Card[];
  removed: boolean[];
  /** Undrawn stock cards. The front card is the next to turn over. */
  stock: Card[];
  /** Turned-over cards not yet removed. The last one is the playable top. */
  waste: Card[];
  /** Removals made since the last turn-over, and the score so far. */
  streak: number;
  score: number;
}

export type PyramidSource = { type: "pyr"; i: number } | { type: "waste" };
export type PyramidMove =
  | { type: "draw" }
  | { type: "king"; from: PyramidSource }
  | { type: "pair"; a: PyramidSource; b: PyramidSource };

const rowStart = (r: number) => (r * (r + 1)) / 2;

/** The two pyramid cards that cover card `i`. The bottom row is covered by nothing. */
export const COVERS: number[][] = (() => {
  const covers: number[][] = [];
  for (let r = 0; r < 7; r++) {
    for (let p = 0; p <= r; p++) {
      covers[rowStart(r) + p] = r === 6 ? [] : [rowStart(r + 1) + p, rowStart(r + 1) + p + 1];
    }
  }
  return covers;
})();

/** Rank value for pairing: Ace is 1, King is 13. */
const pairValue = (card: Card): number => valueIndex(card.value) + 1;

/** The 52-card deck for a deal number, shuffled with the same generator as FreeCell. Shared by the peak and pyramid games. */
export function dealDeck(dealNumber: number): Card[] {
  const rand = makeRand(dealNumber);
  const deck: Card[] = [];
  for (const suit of SUITS as Suit[]) {
    for (const value of VALUES as Value[]) deck.push({ suit, value, faceUp: true });
  }
  for (let i = 51; i >= 1; i--) {
    const j = rand() % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/** Deal a numbered Pyramid game: 28 cards for the pyramid, the other 24 for the stock. */
export function dealPyramid(dealNumber: number): PyramidState {
  const deck = dealDeck(dealNumber);
  return {
    pyramid: deck.slice(0, PYRAMID_SIZE),
    removed: Array(PYRAMID_SIZE).fill(false),
    stock: deck.slice(PYRAMID_SIZE),
    waste: [],
    streak: 0,
    score: 0,
  };
}

/** A pyramid card can be played when it is not yet removed and both cards covering it are gone. */
export function isAvailable(state: PyramidState, i: number): boolean {
  return !state.removed[i] && COVERS[i]!.every((j) => state.removed[j]);
}

function cardAt(state: PyramidState, source: PyramidSource): Card | null {
  if (source.type === "waste") return state.waste[state.waste.length - 1] ?? null;
  return isAvailable(state, source.i) ? state.pyramid[source.i]! : null;
}

function sameSource(a: PyramidSource, b: PyramidSource): boolean {
  if (a.type === "waste" || b.type === "waste") return a.type === b.type;
  return a.i === b.i;
}

function sources(state: PyramidState): PyramidSource[] {
  const list: PyramidSource[] = [];
  for (let i = 0; i < PYRAMID_SIZE; i++) if (isAvailable(state, i)) list.push({ type: "pyr", i });
  if (state.waste.length > 0) list.push({ type: "waste" });
  return list;
}

/** Score one removal event (a King or a pair), then extend the streak. */
function scoreEvent(state: PyramidState): Pick<PyramidState, "streak" | "score"> {
  return { streak: state.streak + 1, score: state.score + 10 * (state.streak + 1) };
}

/** Apply a move. Returns the new state, or null if the move is not legal. */
export function applyPyramid(state: PyramidState, move: PyramidMove): PyramidState | null {
  if (move.type === "draw") {
    // With the stock empty, turning over recycles the waste back into the stock, in the same order.
    if (state.stock.length === 0) {
      if (state.waste.length === 0) return null;
      return { ...state, stock: state.waste, waste: [], streak: 0 };
    }
    return { ...state, stock: state.stock.slice(1), waste: [...state.waste, state.stock[0]!], streak: 0 };
  }

  if (move.type === "king") {
    const card = cardAt(state, move.from);
    if (!card || pairValue(card) !== TARGET) return null;
    return remove(state, [move.from], scoreEvent(state));
  }

  const { a, b } = move;
  if (sameSource(a, b)) return null;
  const cardA = cardAt(state, a);
  const cardB = cardAt(state, b);
  // A waste card and a pyramid card must not both come from the waste pile.
  if (!cardA || !cardB || (a.type === "waste" && b.type === "waste")) return null;
  if (pairValue(cardA) + pairValue(cardB) !== TARGET) return null;
  if (pairValue(cardA) === TARGET || pairValue(cardB) === TARGET) return null;
  return remove(state, [a, b], scoreEvent(state));
}

function remove(state: PyramidState, from: PyramidSource[], extra: Pick<PyramidState, "streak" | "score">): PyramidState {
  const removed = state.removed.slice();
  let waste = state.waste;
  for (const source of from) {
    if (source.type === "waste") waste = waste.slice(0, -1);
    else removed[source.i] = true;
  }
  return { ...state, removed, waste, ...extra };
}

/** Every legal move from this state. Removals come before turn-overs, so the solver tries progress first. */
export function pyramidMoves(state: PyramidState): PyramidMove[] {
  const moves: PyramidMove[] = [];
  const list = sources(state);
  for (const from of list) {
    if (pairValue(cardAt(state, from)!) === TARGET) moves.push({ type: "king", from });
  }
  for (let x = 0; x < list.length; x++) {
    for (let y = x + 1; y < list.length; y++) {
      const move: PyramidMove = { type: "pair", a: list[x]!, b: list[y]! };
      if (applyPyramid(state, move)) moves.push(move);
    }
  }
  if (state.stock.length > 0 || state.waste.length > 0) moves.push({ type: "draw" });
  return moves;
}

export function isPyramidWon(state: PyramidState): boolean {
  return state.removed.every(Boolean);
}

/**
 * True when some pyramid card can never be removed: it is not a King, and no other card
 * still in play (pyramid, stock or waste) can partner it to make 13.
 */
export function isPyramidDead(state: PyramidState): boolean {
  const counts = new Array<number>(14).fill(0);
  state.pyramid.forEach((card, i) => {
    if (!state.removed[i]) counts[pairValue(card)]!++;
  });
  for (const card of state.stock) counts[pairValue(card)]!++;
  for (const card of state.waste) counts[pairValue(card)]!++;
  return state.pyramid.some((card, i) => {
    if (state.removed[i]) return false;
    const v = pairValue(card);
    return v !== TARGET && counts[TARGET - v] === 0;
  });
}

const code = (c: Card) => `${c.value}${c.suit}`;

export const pyramidPuzzle: Puzzle<PyramidState, PyramidMove> = {
  moves: pyramidMoves,
  apply: (state, move) => applyPyramid(state, move) ?? state,
  dead: isPyramidDead,
  // Score and streak do not affect whether a deal can be won, so they are left out of the key.
  key: (state) =>
    `${state.removed.map((r) => (r ? "1" : "0")).join("")}|${state.stock.map(code).join(",")}|${state.waste.map(code).join(",")}`,
  won: isPyramidWon,
};
