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

  it("keeps each mode and Klondike draw mode separate", () => {
    let s = recordWin(migrateStats(null, null), "freecell", 5000, 400);
    s = recordStart(s, "klondike-1");
    s = recordWin(s, "klondike-3", 7000, 300);
    expect(modeOf(s, "klondike-1")).toEqual({ played: 1, won: 0, bestScore: 0, bestSeconds: null });
    expect(modeOf(s, "klondike-3").won).toBe(1);
    expect(modeOf(s, "freecell").won).toBe(1);
  });
});

describe("old-save migration", () => {
  it("reads a legacy best score as Draw 1 Klondike's best", () => {
    const s = migrateStats(null, "4200");
    expect(s.version).toBe(STATS_VERSION);
    expect(modeOf(s, "klondike-1")).toEqual({ played: 0, won: 0, bestScore: 4200, bestSeconds: null });
  });

  it("moves old Klondike stats to Draw 1 and ignores the legacy key once stats exist", () => {
    const current = JSON.stringify({ version: STATS_VERSION, modes: { klondike: { played: 3, won: 1, bestScore: 900, bestSeconds: 600 } } });
    expect(modeOf(migrateStats(current, "4200"), "klondike-1").bestScore).toBe(900);
  });

  it("treats damaged legacy values and damaged stats JSON safely", () => {
    expect(migrateStats(null, "not a number").modes).toEqual({});
    expect(migrateStats(null, "-50").modes).toEqual({});
    expect(migrateStats("{oops", "1200").modes["klondike-1"]?.bestScore).toBe(1200);
  });

  it("reads unknown versions as no file", () => {
    const old = JSON.stringify({ version: 1, modes: { klondike: { played: 9, won: 9, bestScore: 9 } } });
    expect(migrateStats(old, "700").modes["klondike-1"]?.bestScore).toBe(700);
  });

  it("zeroes non-numeric fields in saved data", () => {
    const bad = JSON.stringify({ version: STATS_VERSION, modes: { klondike: { played: "many", won: 2, bestScore: NaN, bestSeconds: -1 } } });
    expect(modeOf(migrateStats(bad, null), "klondike-1")).toEqual({ played: 0, won: 2, bestScore: 0, bestSeconds: null });
  });
});

describe("initial game stats", () => {
  it("counts the initial game in the selected draw mode", () => {
    expect(modeOf(loadInitialStats(null, "4200"), "klondike-1")).toEqual({ played: 1, won: 0, bestScore: 4200, bestSeconds: null });
    expect(modeOf(loadInitialStats(null, null, "klondike-3"), "klondike-3").played).toBe(1);
  });

  it("counts the initial game on top of migrated saved stats", () => {
    const saved = JSON.stringify({ version: STATS_VERSION, modes: { klondike: { played: 3, won: 1, bestScore: 900, bestSeconds: 600 } } });
    expect(modeOf(loadInitialStats(saved, null), "klondike-1").played).toBe(4);
  });
});
