export const DAILY_STATS_KEY = "freesolitaire-daily-stats";

export interface DailyResult {
  date: string;
  drawMode: 1 | 3;
  played: boolean;
  won: boolean;
  moves: number | null;
  seconds: number | null;
}

export interface DailyStats {
  results: Record<string, DailyResult>;
  currentStreak: number;
  bestStreak: number;
  lastWinDate: string | null;
}

const empty = (): DailyStats => ({ results: {}, currentStreak: 0, bestStreak: 0, lastWinDate: null });
const resultKey = (date: string, drawMode: 1 | 3) => `${date}:draw-${drawMode}`;

export function loadDailyStats(raw: string | null): DailyStats {
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStats>;
    if (!parsed || typeof parsed !== "object" || !parsed.results || typeof parsed.results !== "object") return empty();
    return {
      results: parsed.results as Record<string, DailyResult>,
      currentStreak: Number.isSafeInteger(parsed.currentStreak) && parsed.currentStreak! >= 0 ? parsed.currentStreak! : 0,
      bestStreak: Number.isSafeInteger(parsed.bestStreak) && parsed.bestStreak! >= 0 ? parsed.bestStreak! : 0,
      lastWinDate: typeof parsed.lastWinDate === "string" ? parsed.lastWinDate : null,
    };
  } catch {
    return empty();
  }
}

function previousDate(date: string): string {
  const previous = new Date(`${date}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export function recordDailyStart(stats: DailyStats, date: string, drawMode: 1 | 3): DailyStats {
  const key = resultKey(date, drawMode);
  const existing = stats.results[key];
  return {
    ...stats,
    results: { ...stats.results, [key]: { date, drawMode, played: true, won: existing?.won ?? false, moves: existing?.moves ?? null, seconds: existing?.seconds ?? null } },
  };
}

export function recordDailyWin(stats: DailyStats, date: string, drawMode: 1 | 3, moves: number, seconds: number): DailyStats {
  const key = resultKey(date, drawMode);
  const existing = stats.results[key];
  // Replaying the same daily deal cannot advance a streak more than once.
  const firstWin = !existing?.won;
  const currentStreak = firstWin
    ? stats.lastWinDate === previousDate(date) ? stats.currentStreak + 1 : stats.lastWinDate === date ? stats.currentStreak : 1
    : stats.currentStreak;
  return {
    ...stats,
    results: { ...stats.results, [key]: { date, drawMode, played: true, won: true, moves, seconds } },
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    lastWinDate: firstWin && stats.lastWinDate !== date ? date : stats.lastWinDate,
  };
}
