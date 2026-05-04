export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Value = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  value: Value;
  faceUp: boolean;
}

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const VALUES: Value[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function valueIndex(value: Value): number {
  return VALUES.indexOf(value);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, faceUp: false });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export function cardId(card: Card): string {
  return `${card.value}-${card.suit}`;
}
