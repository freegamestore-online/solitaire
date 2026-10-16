/**
 * A generic depth-first solver for single-player card games. A game supplies its
 * moves, how a move changes a state, a key that identifies a state, and the win test.
 * The search remembers every state it has visited, and stops after `budget` states
 * so a hard deal can't hang the page. "unknown" means the budget ran out.
 */
export interface Puzzle<S, M> {
  moves(state: S): M[];
  apply(state: S, move: M): S;
  key(state: S): string;
  won(state: S): boolean;
  /** Optional: true when no win is possible from this state, so the search can stop early. */
  dead?(state: S): boolean;
}

export type SolveResult = "solved" | "unsolvable" | "unknown";

const DEFAULT_BUDGET = 20000;

/** Search for a winning line from `start`. */
export function solve<S, M>(start: S, puzzle: Puzzle<S, M>, budget = DEFAULT_BUDGET): SolveResult {
  const seen = new Set<string>();
  let visited = 0;

  // "win" ends the search, "budget" stops it early, "dead" means no win below this state.
  const visit = (state: S): "win" | "dead" | "budget" => {
    if (puzzle.won(state)) return "win";
    if (puzzle.dead?.(state)) return "dead";
    const key = puzzle.key(state);
    if (seen.has(key)) return "dead";
    seen.add(key);
    if (++visited > budget) return "budget";
    for (const move of puzzle.moves(state)) {
      const result = visit(puzzle.apply(state, move));
      if (result !== "dead") return result;
    }
    return "dead";
  };

  const result = visit(start);
  if (result === "win") return "solved";
  return result === "budget" ? "unknown" : "unsolvable";
}

/**
 * Find the first deal number at or after `from` whose deal the solver can win.
 * `build` turns a deal number into a starting state. Returns null if none of the
 * `tries` numbers is solved within the budget.
 */
export function findSolvableDeal<S, M>(
  from: number,
  build: (dealNumber: number) => S,
  puzzle: Puzzle<S, M>,
  { tries = 200, budget = DEFAULT_BUDGET, maxDeal }: { tries?: number; budget?: number; maxDeal?: number } = {},
): { dealNumber: number; state: S } | null {
  const attempts = maxDeal === undefined ? tries : Math.min(tries, maxDeal);
  for (let offset = 0; offset < attempts; offset++) {
    const n = maxDeal === undefined ? from + offset : ((from - 1 + offset) % maxDeal) + 1;
    const state = build(n);
    if (solve(state, puzzle, budget) === "solved") return { dealNumber: n, state };
  }
  return null;
}
