import { makeRand } from "./freecell";

/** A random source in [0, 1) that repeats for the same seed, so a daily deal is the same for everyone. */
export function seededRandom(seed: number): () => number {
  const next = makeRand(seed);
  return () => next() / 0x8000;
}
