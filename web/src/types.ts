import type { SpiderSuitCount } from "./lib/spider";

export type GamePhase = "menu" | "playing" | "won";

export type Difficulty = "draw1" | "draw3";

/** Which game is on the board: Klondike, Spider with 1, 2 or 4 suits, or FreeCell. */
export type Variant = "klondike" | SpiderSuitCount | "freecell";
