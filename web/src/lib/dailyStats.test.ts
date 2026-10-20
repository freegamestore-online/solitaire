import { describe, expect, it } from "vitest";
import { loadDailyStats, recordDailyStart, recordDailyWin } from "./dailyStats";

describe("daily results", () => {
  it("records moves and time independently for each draw mode", () => {
    let stats = recordDailyStart(loadDailyStats(null), "2026-10-16", 1);
    stats = recordDailyWin(stats, "2026-10-16", 1, 84, 421);
    stats = recordDailyStart(stats, "2026-10-16", 3);
    expect(stats.results["2026-10-16:draw-1"]).toMatchObject({ played: true, won: true, moves: 84, seconds: 421 });
    expect(stats.results["2026-10-16:draw-3"]).toMatchObject({ played: true, won: false, moves: null, seconds: null });
  });

  it("tracks consecutive UTC-day wins without counting a replay twice", () => {
    let stats = loadDailyStats(null);
    stats = recordDailyWin(stats, "2026-10-16", 1, 40, 300);
    stats = recordDailyWin(stats, "2026-10-16", 1, 38, 290);
    expect(stats.currentStreak).toBe(1);
    stats = recordDailyWin(stats, "2026-10-17", 3, 51, 400);
    expect(stats).toMatchObject({ currentStreak: 2, bestStreak: 2, lastWinDate: "2026-10-17" });
    stats = recordDailyWin(stats, "2026-10-19", 1, 72, 500);
    expect(stats).toMatchObject({ currentStreak: 1, bestStreak: 2, lastWinDate: "2026-10-19" });
  });

  it("loads damaged storage safely", () => {
    expect(loadDailyStats("not json")).toEqual({ results: {}, currentStreak: 0, bestStreak: 0, lastWinDate: null });
  });
});
