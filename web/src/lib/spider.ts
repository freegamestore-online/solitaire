import { SUITS, VALUES, valueIndex, type Card, type Suit } from "./cards";

/** How many suits the Spider deck uses. Two full decks (104 cards) are always dealt. */
export type SpiderSuitCount = 1 | 2 | 4;

/** A Spider card. `uid` tells copies of the same card apart, since two decks are in play. */
export interface SpiderCard extends Card {
  uid: number;
}

export interface SpiderState {
  /** 10 columns, bottom card first. Face-down cards sit at the start of each column. */
  tableau: SpiderCard[][];
  /** Face-down cards still to deal. Each deal takes the last 10. */
  stock: SpiderCard[];
  /** Complete K-to-A same-suit runs removed so far, 0 to RUNS_TO_WIN. */
  completed: number;
}

export const COLUMNS = 10;
export const RUNS_TO_WIN = 8;
const DEAL_SIZE = COLUMNS;
const KING_INDEX = 12;

/** The suits used for a given suit count. One suit uses spades, two use spades and hearts. */
export function suitsFor(count: SpiderSuitCount): Suit[] {
  if (count === 1) return ["spades"];
  if (count === 2) return ["spades", "hearts"];
  return [...SUITS];
}

/** Two decks of 104 cards, spread over the chosen suits so every suit count has the same size. */
export function buildSpiderDeck(count: SpiderSuitCount): SpiderCard[] {
  const deck: SpiderCard[] = [];
  const copies = 8 / count;
  let uid = 0;
  for (let copy = 0; copy < copies; copy++) {
    for (const suit of suitsFor(count)) {
      for (const value of VALUES) {
        deck.push({ suit, value, faceUp: false, uid: uid++ });
      }
    }
  }
  return deck;
}

function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Deal a fresh game: columns 1–4 get 6 cards and columns 5–10 get 5. Only the top
 * card of each column is face up. The other 50 cards form the stock.
 */
export function dealSpider(deck: SpiderCard[]): SpiderState {
  const tableau: SpiderCard[][] = [];
  let i = 0;
  for (let col = 0; col < COLUMNS; col++) {
    const size = col < 4 ? 6 : 5;
    const column: SpiderCard[] = [];
    for (let row = 0; row < size; row++) {
      column.push({ ...deck[i++]!, faceUp: row === size - 1 });
    }
    tableau.push(column);
  }
  const stock = deck.slice(i).map((c) => ({ ...c, faceUp: false }));
  return { tableau, stock, completed: 0 };
}

export function newSpiderGame(count: SpiderSuitCount, random?: () => number): SpiderState {
  return dealSpider(shuffle(buildSpiderDeck(count), random));
}

const rankOf = (card: Card): number => valueIndex(card.value);

/**
 * True when the cards from `index` to the bottom of the column form a run: all face
 * up, each card one rank below the card above it. Suits may differ. Only runs can move.
 */
export function isRunFrom(column: SpiderCard[], index: number): boolean {
  if (index < 0 || index >= column.length || !column[index]!.faceUp) return false;
  for (let i = index; i < column.length - 1; i++) {
    const above = column[i]!;
    const below = column[i + 1]!;
    if (!below.faceUp || rankOf(below) !== rankOf(above) - 1) return false;
  }
  return true;
}

/**
 * Whether a card can be placed on a column. An empty column takes any card. Otherwise
 * the column's top card must be face up and exactly one rank above, in any suit.
 */
export function canDropOn(card: Card, column: SpiderCard[]): boolean {
  if (column.length === 0) return true;
  const top = column[column.length - 1]!;
  return top.faceUp && rankOf(top) === rankOf(card) + 1;
}

/**
 * Index where a complete run starts: 13 cards at the bottom of the column, King down
 * to Ace, all one suit and all face up. Returns -1 when there is no such run.
 */
export function completedRunStart(column: SpiderCard[]): number {
  const start = column.length - 13;
  if (start < 0) return -1;
  const suit = column[start]!.suit;
  for (let k = 0; k < 13; k++) {
    const card = column[start + k]!;
    if (!card.faceUp || card.suit !== suit || rankOf(card) !== KING_INDEX - k) return -1;
  }
  return start;
}

function turnTopFaceUp(column: SpiderCard[]): SpiderCard[] {
  const top = column[column.length - 1];
  if (!top || top.faceUp) return column;
  return [...column.slice(0, -1), { ...top, faceUp: true }];
}

/** Remove any complete runs from one column. Each removal can reveal a card, which may complete another run. */
function removeCompletedRuns(state: SpiderState, col: number): SpiderState {
  let next = state;
  let start = completedRunStart(next.tableau[col]!);
  while (start >= 0) {
    const tableau = next.tableau.slice();
    tableau[col] = turnTopFaceUp(tableau[col]!.slice(0, start));
    next = { ...next, tableau, completed: next.completed + 1 };
    start = completedRunStart(next.tableau[col]!);
  }
  return next;
}

/**
 * Move the run that starts at `fromIndex` in column `fromCol` onto column `toCol`.
 * Returns the new state, or null when the move is illegal. Removes any run the move
 * completes, and turns over the card it uncovers.
 */
export function moveRun(state: SpiderState, fromCol: number, fromIndex: number, toCol: number): SpiderState | null {
  if (fromCol === toCol) return null;
  const source = state.tableau[fromCol];
  const target = state.tableau[toCol];
  if (!source || !target || !isRunFrom(source, fromIndex)) return null;
  const moving = source.slice(fromIndex);
  if (!canDropOn(moving[0]!, target)) return null;

  const tableau = state.tableau.slice();
  tableau[fromCol] = turnTopFaceUp(source.slice(0, fromIndex));
  tableau[toCol] = [...target, ...moving];
  return removeCompletedRuns({ ...state, tableau }, toCol);
}

/**
 * Deal one card face up to each column from the stock. Illegal while any column is
 * empty or the stock is empty. Returns null in those cases.
 */
export function dealFromStock(state: SpiderState): SpiderState | null {
  if (state.stock.length < DEAL_SIZE) return null;
  if (state.tableau.some((col) => col.length === 0)) return null;
  const dealt = state.stock.slice(-DEAL_SIZE);
  const tableau = state.tableau.map((col, i) => [...col, { ...dealt[i]!, faceUp: true }]);
  let next: SpiderState = { ...state, tableau, stock: state.stock.slice(0, -DEAL_SIZE) };
  for (let col = 0; col < COLUMNS; col++) next = removeCompletedRuns(next, col);
  return next;
}

export function isSpiderWon(state: SpiderState): boolean {
  return state.completed === RUNS_TO_WIN;
}
