import { describe, it, expect } from "vitest";
import { STATS_VERSION, loadInitialStats, migrateStats, modeOf, recordStart, recordWin } from "./stats";

describe("stats", () => {
  it("counts a start and a win for a mode, and keeps the best of each", () => {
    let s = migrateStats(null, null);
    s = recordStart(s, "spider-2");
    s = recordWin(s, "spider-2", 4200, 310);
    s = recordWin(s, "spider-2", 3900, 280);
    expect(modeOf(s, "spider-2")).toEqual({ played: 1, won: 2, bestScore: 4200, bestSeconds: 280 });
  });

  it("keeps each mode separate", () => {
    const s = recordWin(migrateStats(null, null), "freecell", 5000, 400);
    expect(modeOf(s, "klondike").won).toBe(0);
    expect(modeOf(s, "freecell").won).toBe(1);
  });
});

describe("old-save migration", () => {
  it("reads a legacy best score as Klondike's best, when there is no stats file", () => {
    const s = migrateStats(null, "4200");
    expect(s.version).toBe(STATS_VERSION);
    expect(modeOf(s, "klondike")).toEqual({ played: 0, won: 0, bestScore: 4200, bestSeconds: null });
  });

  it("ignores the legacy key once a stats file exists", () => {
    const current = JSON.stringify({ version: STATS_VERSION, modes: { klondike: { played: 3, won: 1, bestScore: 900, bestSeconds: 600 } } });
    expect(modeOf(migrateStats(current, "4200"), "klondike").bestScore).toBe(900);
  });

  it("treats a damaged legacy value as no score", () => {
    expect(migrateStats(null, "not a number").modes).toEqual({});
    expect(migrateStats(null, "-50").modes).toEqual({});
  });

  it("treats damaged stats JSON as no file, and falls back to the legacy key", () => {
    expect(modeOf(migrateStats("{oops", "1200"), "klondike").bestScore).toBe(1200);
  });

  it("reads an unknown version as no file", () => {
    const old = JSON.stringify({ version: 1, modes: { klondike: { played: 9, won: 9, bestScore: 9 } } });
    expect(migrateStats(old, "700").modes.klondike?.bestScore).toBe(700);
  });

  it("zeroes non-numeric fields in a saved file", () => {
    const bad = JSON.stringify({ version: STATS_VERSION, modes: { klondike: { played: "many", won: 2, bestScore: NaN, bestSeconds: -1 } } });
    expect(modeOf(migrateStats(bad, null), "klondike")).toEqual({ played: 0, won: 2, bestScore: 0, bestSeconds: null });
  });
});

describe("initial game stats", () => {
  it("counts the Klondike game that starts on the first page load", () => {
    const s = loadInitialStats(null, "4200");
    expect(modeOf(s, "klondike")).toEqual({ played: 1, won: 0, bestScore: 4200, bestSeconds: null });
  });

  it("counts the initial game on top of saved stats", () => {
    const saved = JSON.stringify({ version: STATS_VERSION, modes: { klondike: { played: 3, won: 1, bestScore: 900, bestSeconds: 600 } } });
    expect(modeOf(loadInitialStats(saved, null), "klondike").played).toBe(4);
  });
});
