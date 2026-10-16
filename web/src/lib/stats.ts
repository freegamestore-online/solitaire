/**
 * Per-mode stats, saved as one JSON object. The file has a version, so a later change
 * can migrate it. Before stats existed, Klondike's only saved data was the best score in
 * the `freesolitaire-best` key. `migrateStats` reads that key once, when there is no stats file yet.
 */
export const STATS_KEY = "freesolitaire-stats";
export const LEGACY_BEST_KEY = "freesolitaire-best";
export const STATS_VERSION = 2;

export interface ModeStats {
  played: number;
  won: number;
  bestScore: number;
  /** Fastest win in seconds, or null if none yet. */
  bestSeconds: number | null;
}

export interface StatsFile {
  version: typeof STATS_VERSION;
  modes: Record<string, ModeStats>;
}

const emptyMode = (): ModeStats => ({ played: 0, won: 0, bestScore: 0, bestSeconds: null });

const nonNegative = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Keep only well-formed numbers, so a damaged file reads as zero instead of breaking the page. */
function sanitizeMode(raw: unknown): ModeStats {
  if (!raw || typeof raw !== "object") return emptyMode();
  const r = raw as Record<string, unknown>;
  const seconds = nonNegative(r.bestSeconds);
  return {
    played: nonNegative(r.played),
    won: nonNegative(r.won),
    bestScore: nonNegative(r.bestScore),
    bestSeconds: typeof r.bestSeconds === "number" && seconds > 0 ? seconds : null,
  };
}

/**
 * Load the stats file. If there isn't one, start from the legacy best score, which
 * becomes Klondike's best. Damaged JSON is treated as no file.
 */
export function migrateStats(raw: string | null, legacyBest: string | null): StatsFile {
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as { version?: unknown; modes?: unknown };
      if (parsed && parsed.version === STATS_VERSION && parsed.modes && typeof parsed.modes === "object") {
        const modes: Record<string, ModeStats> = {};
        for (const [name, mode] of Object.entries(parsed.modes as Record<string, unknown>)) {
          modes[name] = sanitizeMode(mode);
        }
        return { version: STATS_VERSION, modes };
      }
    } catch {
      // Fall through to the legacy path, as for a missing file.
    }
  }
  const best = legacyBest === null ? 0 : nonNegative(parseInt(legacyBest, 10));
  const modes: Record<string, ModeStats> = {};
  if (best > 0) modes.klondike = { ...emptyMode(), bestScore: best };
  return { version: STATS_VERSION, modes };
}

export function modeOf(file: StatsFile, mode: string): ModeStats {
  return file.modes[mode] ?? emptyMode();
}

export function recordStart(file: StatsFile, mode: string): StatsFile {
  const current = modeOf(file, mode);
  return { ...file, modes: { ...file.modes, [mode]: { ...current, played: current.played + 1 } } };
}

export function recordWin(file: StatsFile, mode: string, score: number, seconds: number): StatsFile {
  const current = modeOf(file, mode);
  const next: ModeStats = {
    ...current,
    won: current.won + 1,
    bestScore: Math.max(current.bestScore, score),
    bestSeconds: current.bestSeconds === null ? seconds : Math.min(current.bestSeconds, seconds),
  };
  return { ...file, modes: { ...file.modes, [mode]: next } };
}
