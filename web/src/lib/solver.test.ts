import { describe, it, expect } from "vitest";
import { findSolvableDeal, solve, type Puzzle } from "./solver";

// A toy game: a counter climbs from 0 by 1 or 2, and wins at `goal`.
const climb = (goal: number): Puzzle<number, number> => ({
  moves: (n) => (n >= goal ? [] : [1, 2].filter((step) => n + step <= goal)),
  apply: (n, step) => n + step,
  key: (n) => String(n),
  won: (n) => n === goal,
});

describe("generic solver", () => {
  it("finds a win when one exists", () => {
    expect(solve(0, climb(5))).toBe("solved");
  });

  it("reports unsolvable when no line reaches the goal", () => {
    const stuck: Puzzle<number, number> = { moves: () => [], apply: (n) => n, key: String, won: () => false };
    expect(solve(0, stuck)).toBe("unsolvable");
  });

  it("stops and reports unknown when the budget runs out", () => {
    expect(solve(0, climb(50), 3)).toBe("unknown");
  });

  it("wraps numbered deals at the maximum without returning an invalid deal number", () => {
    const found = findSolvableDeal(3, (n) => n, {
      moves: () => [],
      apply: (n) => n,
      key: String,
      won: (n) => n === 1,
    }, { tries: 2, maxDeal: 3 });

    expect(found?.dealNumber).toBe(1);
  });
});
