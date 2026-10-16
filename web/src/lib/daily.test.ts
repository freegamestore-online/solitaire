import { describe, it, expect } from "vitest";
import { dailyDealNumber, dateKey } from "./daily";
import { MAX_DEAL } from "./freecell";

describe("daily deals", () => {
  it("gives the same number for the same mode and date", () => {
    expect(dailyDealNumber("klondike", "2026-10-16")).toBe(dailyDealNumber("klondike", "2026-10-16"));
  });

  it("gives each mode its own deal on the same day", () => {
    const modes = ["klondike", "spider-1", "spider-2", "spider-4", "freecell", "tripeaks", "pyramid"];
    const numbers = new Set(modes.map((m) => dailyDealNumber(m, "2026-10-16")));
    expect(numbers.size).toBe(modes.length);
  });

  it("changes with the date", () => {
    expect(dailyDealNumber("freecell", "2026-10-16")).not.toBe(dailyDealNumber("freecell", "2026-10-17"));
  });

  it("stays within the numbered deal range", () => {
    for (let day = 1; day <= 30; day++) {
      const n = dailyDealNumber("pyramid", `2026-10-${String(day).padStart(2, "0")}`);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(MAX_DEAL);
    }
  });

  it("uses the UTC date, so the day changes for everyone at once", () => {
    expect(dateKey(new Date("2026-10-16T23:59:59Z"))).toBe("2026-10-16");
    expect(dateKey(new Date("2026-10-17T00:00:00Z"))).toBe("2026-10-17");
  });
});
