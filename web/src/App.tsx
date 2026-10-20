import { useState, useCallback, useEffect, useRef } from "react";
import { GameShell, GameTopbar, GameAuth, Leaderboard } from "@freegamestore/games";
import { Game, type GameHandle } from "./components/Game";
import { Spider } from "./components/Spider";
import { FreeCell } from "./components/FreeCell";
import { TriPeaks } from "./components/TriPeaks";
import { Pyramid } from "./components/Pyramid";
import { MAX_DEAL, parseDealNumber, randomDealNumber } from "./lib/freecell";
import { dealTriPeaks, triPeaksPuzzle } from "./lib/tripeaks";
import { dealPyramid, pyramidPuzzle } from "./lib/pyramid";
import { findSolvableDeal } from "./lib/solver";
import { dailyDealNumber, dateKey } from "./lib/daily";
import { DAILY_STATS_KEY, loadDailyStats, recordDailyStart, recordDailyWin } from "./lib/dailyStats";
import {
  LEGACY_BEST_KEY,
  STATS_KEY,
  loadInitialStats,
  modeOf,
  recordStart,
  recordWin,
  type StatsFile,
} from "./lib/stats";
import { useLeaderboard } from '@freegamestore/games';
import { loadDrawMode, saveDrawMode, type DrawMode } from "./lib/drawMode";
import { formatDuration } from "./lib/time";
import { Celebration, ParticleLayer, type ParticleLayerHandle } from "./feel";
import type { GamePhase, Variant } from "./types";

const WIN_COLOURS = ["#16a34a", "#2563eb", "#d97706"];

/** Daily times go up the board as higher scores: 100000 minus the seconds taken. */
const DAILY_SCORE_BASE = 100000;

const MODES: { value: Variant; label: string }[] = [
  { value: "klondike", label: "Klondike" },
  { value: 1, label: "Spider · 1 suit" },
  { value: 2, label: "Spider · 2 suits" },
  { value: 4, label: "Spider · 4 suits" },
  { value: "freecell", label: "FreeCell" },
  { value: "tripeaks", label: "TriPeaks" },
  { value: "pyramid", label: "Pyramid" },
];

/** The key a mode goes by in stats, and in the daily deal and leaderboard names. */
const modeKey = (variant: Variant, drawMode: DrawMode = 1): string => variant === "klondike" ? `klondike-${drawMode}` : String(variant);

/** The first deal at or after `from` that the solver can win. Falls back to `from` if none of the next few is solvable. */
function solvableDeal(variant: "tripeaks" | "pyramid", from: number): number {
  const found =
    variant === "tripeaks"
      ? findSolvableDeal(from, dealTriPeaks, triPeaksPuzzle, { maxDeal: MAX_DEAL })
      : findSolvableDeal(from, dealPyramid, pyramidPuzzle, { maxDeal: MAX_DEAL });
  return found?.dealNumber ?? from;
}

/** Format seconds as m:ss, for stats. */

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [variant, setVariant] = useState<Variant>("klondike");
  const [drawMode, setDrawMode] = useState<DrawMode>(() => loadDrawMode(localStorage));
  const [dealNumber, setDealNumber] = useState(() => randomDealNumber());
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [isDaily, setIsDaily] = useState(false);
  const [dailyDate, setDailyDate] = useState<string | null>(null);
  const [dailyStats, setDailyStats] = useState(() => loadDailyStats(localStorage.getItem(DAILY_STATS_KEY)));
  const [dealInput, setDealInput] = useState("");
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState<StatsFile>(() => loadInitialStats(localStorage.getItem(STATS_KEY), localStorage.getItem(LEGACY_BEST_KEY), modeKey("klondike", drawMode)));
  const [gameKey, setGameKey] = useState(0);
  const [meta, setMeta] = useState({ moves: 0, time: "0:00", canUndo: false });
  const scoreRef = useRef(0);
  const startedAt = useRef(Date.now());
  const gameRef = useRef<GameHandle>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const particleRef = useRef<ParticleLayerHandle>(null);
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const leaderboardKey = `solitaire-${modeKey(variant, drawMode)}`;
  const { topScores, recentScores, submitScore, loading: leaderboardLoading, refresh: refreshLeaderboard } = useLeaderboard(leaderboardKey);
  // One daily board per mode, so times from different games are never compared.
  const dailyBoard = useLeaderboard(`solitaire-daily-${modeKey(variant, drawMode)}`);

  useEffect(() => saveDrawMode(localStorage, drawMode), [drawMode]);

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(dailyStats));
  }, [dailyStats]);

  const bestScore = modeOf(stats, modeKey(variant, drawMode)).bestScore;

  const handleScore = useCallback((s: number) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleGameOver = useCallback(() => {
    const final = scoreRef.current;
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    setStats((s) => recordWin(s, modeKey(variant, drawMode), final, seconds));
    if (isDaily) {
      if (dailyDate) setDailyStats((s) => recordDailyWin(s, dailyDate, drawMode, meta.moves, seconds));
      // A daily time is a score on the mode's daily board. The platform may refuse it, and that is not shown.
      dailyBoard.submitScore(DAILY_SCORE_BASE - seconds).then(
        () => undefined,
        () => undefined,
      );
    } else if (variant === "klondike") {
      // The shared leaderboard is for Klondike only. Other modes keep their scores locally.
      submitScore(final);
    }
    setPhase("won");
    // Burst from the middle of the board, then the confetti. Both skip under reduced motion.
    const board = boardRef.current;
    if (board) {
      particleRef.current?.burst(board.clientWidth / 2, board.clientHeight / 3, WIN_COLOURS, {
        count: 40,
        speed: [160, 360],
        size: [3, 6],
        life: 1.2,
      });
    }
    setCelebrationId(`win-${Date.now()}`);
  }, [submitScore, dailyBoard.submitScore, variant, drawMode, isDaily, dailyDate, meta.moves]);

  const endCelebration = useCallback(() => setCelebrationId(null), []);

  /**
   * Start a new game in the given mode. `deal` is the deal number to play, or a random one.
   * A daily game passes today's number and sets `daily`.
   */
  const start = useCallback((next: Variant, deal?: number, daily = false, selectedDrawMode: DrawMode = drawMode) => {
    setVariant(next);
    setIsDaily(daily);
    const startedDailyDate = daily ? dateKey() : null;
    setDailyDate(startedDailyDate);
    if (daily && next === "klondike") setDailyStats((s) => recordDailyStart(s, startedDailyDate!, selectedDrawMode));
    setSeed(daily || next === "klondike" || typeof next === "number" ? deal ?? randomDealNumber() : undefined);
    setDealNumber(deal ?? randomDealNumber());
    if (next === "freecell") setDealNumber(deal ?? randomDealNumber());
    if (next === "tripeaks" || next === "pyramid") setDealNumber(solvableDeal(next, deal ?? randomDealNumber()));
    setScore(0);
    scoreRef.current = 0;
    setCelebrationId(null);
    startedAt.current = Date.now();
    setStats((s) => recordStart(s, modeKey(next, selectedDrawMode)));
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, [drawMode]);

  const today = dateKey();
  const numbered = variant === "klondike" || typeof variant === "number" || variant === "freecell" || variant === "tripeaks" || variant === "pyramid";

  const rules =
    variant === "tripeaks" ? (
      <div>
        <h3 style={{ fontWeight: 700 }}>TriPeaks, deal #{dealNumber}</h3>
        <h4 style={{ fontWeight: 600 }}>Rules</h4>
        <ul>
          <li>Clear the three peaks by playing cards one rank above or below the waste card</li>
          <li>Ace and King are neighbours. Every deal is checked to be winnable</li>
          <li>Build a streak by playing cards in a row without turning over the stock</li>
        </ul>
        <h4 style={{ fontWeight: 600 }}>Controls</h4>
        <ul><li>Tap a free card to play it onto the waste</li><li>Tap the stock pile to turn over the next card</li></ul>
      </div>
    ) : variant === "pyramid" ? (
      <div>
        <h3 style={{ fontWeight: 700 }}>Pyramid, deal #{dealNumber}</h3>
        <h4 style={{ fontWeight: 600 }}>Rules</h4>
        <ul>
          <li>Remove pairs of free cards that add up to 13. Ace counts as 1, Jack 11, Queen 12, King 13</li>
          <li>A King is removed on its own. A card is free when the two cards covering it are gone</li>
          <li>The stock can be turned over as often as you like. Every deal is checked to be winnable</li>
        </ul>
        <h4 style={{ fontWeight: 600 }}>Controls</h4>
        <ul><li>Tap a King to remove it, or tap two cards that make 13</li><li>Tap the stock pile to turn over a card</li></ul>
      </div>
    ) : variant === "freecell" ? (
      <div>
        <h3 style={{ fontWeight: 700 }}>FreeCell, deal #{dealNumber}</h3>
        <h4 style={{ fontWeight: 600 }}>Rules</h4>
        <ul>
          <li>Build foundations from Ace to King by suit</li>
          <li>Columns build down in alternating colours</li>
          <li>Four free cells hold any card. Moves of several cards are limited by the free cells and empty columns</li>
        </ul>
        <h4 style={{ fontWeight: 600 }}>Controls</h4>
        <ul><li>Tap a card to pick it up, then tap a free cell, a column or a foundation to drop it</li><li>Safe cards move to their foundations by themselves</li></ul>
      </div>
    ) : variant === "klondike" ? (
      <div>
        <h3 style={{ fontWeight: 700 }}>Klondike Solitaire</h3>
        <h4 style={{ fontWeight: 600 }}>Rules</h4>
        <ul><li>Build foundation piles from Ace to King by suit</li><li>Tableau builds down in alternating colors</li></ul>
        <h4 style={{ fontWeight: 600 }}>Controls</h4>
        <ul><li>Tap to select a card, tap to place it</li><li>Draw 1 turns over one stock card; Draw 3 turns over up to three. Draw 3 allows one free recycle, then costs 100 points per recycle</li></ul>
      </div>
    ) : (
      <div>
        <h3 style={{ fontWeight: 700 }}>Spider Solitaire ({variant} {variant === 1 ? "suit" : "suits"})</h3>
        <h4 style={{ fontWeight: 600 }}>Rules</h4>
        <ul>
          <li>Build columns down from King to Ace, one rank at a time, in any suit</li>
          <li>Only face-up runs in order can move, and a column can take any card when empty</li>
          <li>Remove a King-to-Ace run of one suit to clear it. Clear all 8 to win</li>
        </ul>
        <h4 style={{ fontWeight: 600 }}>Controls</h4>
        <ul><li>Tap a run to pick it up, then tap a column to drop it</li><li>Tap the stock pile at top left to deal one card to each column</li></ul>
      </div>
    );

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Solitaire"
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Best", value: bestScore },
            { label: "Moves", value: meta.moves },
            { label: "Time", value: meta.time },
          ]}
          actions={
            <>
              <button
                aria-label="Undo"
                onClick={() => gameRef.current?.undo()}
                disabled={!meta.canUndo || phase === "won"}
                className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold transition disabled:opacity-40"
                style={{
                  background: meta.canUndo ? "var(--accent)" : "var(--line)",
                  color: meta.canUndo ? "#fff" : "var(--muted)",
                }}
              >
                Undo
              </button>
              <button
                type="button"
                aria-label="Leaderboard"
                onClick={() => {
                  refreshLeaderboard();
                  setLeaderboardOpen(true);
                }}
                className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold"
                style={{ background: "var(--line)", color: "var(--ink)" }}
              >
                Leaderboard
              </button>
              <GameAuth />
            </>
          }
          rules={rules}
        />
      }
    >
      <div className="flex flex-col w-full h-full">
        <div className="mode-bar flex flex-wrap justify-center gap-2 px-2 pt-2" role="group" aria-label="Game mode">
          {variant === "klondike" && ([1, 3] as const).map((count) => (
            <button key={count} type="button" aria-pressed={drawMode === count} aria-label={`Draw ${count}`}
              onClick={() => { if (drawMode !== count) { setDrawMode(count); start("klondike", undefined, false, count); } }}
              className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold"
              style={{ background: drawMode === count ? "var(--accent)" : "var(--line)", color: drawMode === count ? "#fff" : "var(--muted)" }}>
              Draw {count}
            </button>
          ))}
          {MODES.map((mode) => {
            const active = variant === mode.value;
            return (
              <button
                key={mode.label}
                aria-pressed={active}
                onClick={() => start(mode.value)}
                className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold transition"
                style={{
                  background: active ? "var(--accent)" : "var(--line)",
                  color: active ? "#fff" : "var(--muted)",
                }}
              >
                {mode.label}
              </button>
            );
          })}
          {variant === "klondike" && <button
            type="button"
            onClick={() => start("klondike", dailyDealNumber(modeKey("klondike", drawMode), today), true)}
            className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold"
            style={{ background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line-strong)" }}
          >
            Today&apos;s deal
          </button>}
          {numbered && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseDealNumber(dealInput);
                if (n !== null) start(variant, n);
                setDealInput("");
              }}
            >
              <label className="text-xs font-bold" style={{ color: "var(--muted)" }} htmlFor="deal-number">
                Deal #{dealNumber}
              </label>
              <input
                id="deal-number"
                type="number"
                min={1}
                max={MAX_DEAL}
                value={dealInput}
                onChange={(e) => setDealInput(e.target.value)}
                placeholder="1–32000"
                className="rounded-lg px-2 py-1 w-28 text-xs"
                style={{ background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line-strong)" }}
              />
              <button
                type="submit"
                className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Play deal
              </button>
              <button
                type="button"
                onClick={() => start(variant)}
                className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold"
                style={{ background: "var(--line)", color: "var(--ink)" }}
              >
                Random
              </button>
            </form>
          )}
        </div>
        <div className="stats-line px-2 pt-1 text-xs font-bold" style={{ color: "var(--muted)" }}>
          {isDaily && <span style={{ color: "var(--accent)" }}>Daily deal, {dailyDate} (UTC) · </span>}
          {isDaily && dailyDate && <span data-testid="daily-result">{dailyStats.results[`${dailyDate}:draw-${drawMode}`]?.won ? `Completed · ${dailyStats.results[`${dailyDate}:draw-${drawMode}`]?.moves} moves · ${formatDuration(dailyStats.results[`${dailyDate}:draw-${drawMode}`]?.seconds ?? 0)} · ` : "Not yet completed · "}Streak {dailyStats.currentStreak} (best {dailyStats.bestStreak}) · </span>}
          {(() => {
            const m = modeOf(stats, modeKey(variant, drawMode));
            return (
              <span>
                Played {m.played} · Won {m.won} · Best {m.bestScore}
                {m.bestSeconds !== null && ` · Fastest ${formatDuration(m.bestSeconds)}`}
              </span>
            );
          })()}
        </div>
        <div ref={boardRef} className="relative w-full flex-1 min-h-0">
          {variant === "tripeaks" ? (
            <TriPeaks
              key={gameKey}
              ref={gameRef}
              dealNumber={dealNumber}
              onScore={handleScore}
              onGameOver={handleGameOver}
              onMeta={setMeta}
            />
          ) : variant === "pyramid" ? (
            <Pyramid
              key={gameKey}
              ref={gameRef}
              dealNumber={dealNumber}
              onScore={handleScore}
              onGameOver={handleGameOver}
              onMeta={setMeta}
            />
          ) : variant === "freecell" ? (
            <FreeCell
              key={gameKey}
              ref={gameRef}
              dealNumber={dealNumber}
              onScore={handleScore}
              onGameOver={handleGameOver}
              onMeta={setMeta}
            />
          ) : variant === "klondike" ? (
            <Game
              key={gameKey}
              ref={gameRef}
              drawCount={drawMode}
              seed={seed}
              onScore={handleScore}
              onGameOver={handleGameOver}
              onMeta={setMeta}
            />
          ) : (
            <Spider
              key={gameKey}
              ref={gameRef}
              suits={variant}
              seed={seed}
              onScore={handleScore}
              onGameOver={handleGameOver}
              onMeta={setMeta}
            />
          )}
          <ParticleLayer ref={particleRef} />
          {celebrationId && <Celebration id={celebrationId} onDone={endCelebration} />}
          {phase === "won" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "rgba(0,0,0,0.55)" }}>
              <p
                className="text-xl font-bold"
                style={{ color: "var(--success)", fontFamily: "Fraunces, serif" }}
              >
                You Won! Score: {score}
              </p>
              <button
                onClick={() => start(variant)}
                className="px-6 py-3 rounded-xl font-semibold min-h-[2.75rem]"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Play Again
              </button>
            </div>
          )}
        </div>
        {leaderboardOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leaderboard-title"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={(event) => {
              if (event.target === event.currentTarget) setLeaderboardOpen(false);
            }}
          >
            <section className="w-full max-w-sm rounded-2xl shadow-xl" style={{ background: "var(--paper)", color: "var(--ink)" }}>
              <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
                <h2 id="leaderboard-title" className="font-bold">Klondike Draw {drawMode} leaderboard</h2>
                <button type="button" aria-label="Close leaderboard" onClick={() => setLeaderboardOpen(false)} className="min-h-11 min-w-11 text-xl" style={{ color: "var(--muted)" }}>×</button>
              </header>
              <Leaderboard topScores={topScores} recentScores={recentScores} loading={leaderboardLoading} />
            </section>
          </div>
        )}
      </div>
    </GameShell>
  );
}
