import { MAX_DEAL } from "./freecell";

/** Today's date as YYYY-MM-DD in UTC, so every player gets the same daily deal on the same day. */
export function dateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** FNV-1a hash of a string, as an unsigned 32-bit integer. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * The deal number for a mode on a given day, in 1–32000. Each mode gets its own deal
 * for the same date. The number is used as the seed for Klondike and Spider too.
 */
export function dailyDealNumber(variant: string, date: string): number {
  return 1 + (hash(`${variant}:${date}`) % MAX_DEAL);
}
