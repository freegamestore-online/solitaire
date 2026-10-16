import { useState, useCallback, useEffect, useRef } from "react";
import { GameShell, GameTopbar, GameAuth } from "@freegamestore/games";
import { Game, type GameHandle } from "./components/Game";
import { Spider } from "./components/Spider";
import { useLeaderboard } from '@freegamestore/games';
import { Celebration, ParticleLayer, type ParticleLayerHandle } from "./feel";
import type { GamePhase, Variant } from "./types";

const BEST_SCORE_KEY = "freesolitaire-best";
const WIN_COLOURS = ["#16a34a", "#2563eb", "#d97706"];

const MODES: { value: Variant; label: string }[] = [
  { value: "klondike", label: "Klondike" },
  { value: 1, label: "Spider · 1 suit" },
  { value: 2, label: "Spider · 2 suits" },
  { value: 4, label: "Spider · 4 suits" },
];

/** Klondike keeps the original best-score key, so existing players keep their best. Spider gets its own per suit count. */
function bestKey(variant: Variant): string {
  return variant === "klondike" ? BEST_SCORE_KEY : `freesolitaire-spider-${variant}-best`;
}

function getBestScore(key: string): number {
  const v = localStorage.getItem(key);
  return v ? parseInt(v, 10) : 0;
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [variant, setVariant] = useState<Variant>("klondike");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => getBestScore(bestKey("klondike")));
  const [gameKey, setGameKey] = useState(0);
  const [meta, setMeta] = useState({ moves: 0, time: "0:00", canUndo: false });
  const scoreRef = useRef(0);
  const gameRef = useRef<GameHandle>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const particleRef = useRef<ParticleLayerHandle>(null);
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const { submitScore } = useLeaderboard("solitaire");

  useEffect(() => {
    setBestScore(getBestScore(bestKey(variant)));
  }, [variant]);

  const handleScore = useCallback((s: number) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleGameOver = useCallback(() => {
    const final = scoreRef.current;
    const key = bestKey(variant);
    if (final > getBestScore(key)) {
      localStorage.setItem(key, String(final));
      setBestScore(final);
    }
    // The shared leaderboard is for Klondike only. Spider scores stay local for now.
    if (variant === "klondike") submitScore(final);
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
  }, [submitScore, variant]);

  const endCelebration = useCallback(() => setCelebrationId(null), []);

  /** Start a new game in the given mode. Changing mode always deals a new game. */
  const start = useCallback((next: Variant) => {
    setVariant(next);
    setScore(0);
    scoreRef.current = 0;
    setCelebrationId(null);
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, []);

  const rules =
    variant === "klondike" ? (
      <div>
        <h3 style={{ fontWeight: 700 }}>Klondike Solitaire</h3>
        <h4 style={{ fontWeight: 600 }}>Rules</h4>
        <ul><li>Build foundation piles from Ace to King by suit</li><li>Tableau builds down in alternating colors</li></ul>
        <h4 style={{ fontWeight: 600 }}>Controls</h4>
        <ul><li>Tap to select a card, tap to place it</li><li>Draw 1 or Draw 3 mode available</li></ul>
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
                disabled={!meta.canUndo}
                className="rounded-lg px-3 py-2 min-h-[2.75rem] text-xs font-bold transition disabled:opacity-40"
                style={{
                  background: meta.canUndo ? "var(--accent)" : "var(--line)",
                  color: meta.canUndo ? "#fff" : "var(--muted)",
                }}
              >
                Undo
              </button>
              <GameAuth />
            </>
          }
          rules={rules}
        />
      }
    >
      <div className="flex flex-col w-full h-full">
        <div className="flex flex-wrap justify-center gap-2 px-2 pt-2" role="group" aria-label="Game mode">
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
        </div>
        <div ref={boardRef} className="relative w-full flex-1 min-h-0">
          {variant === "klondike" ? (
            <Game
              key={gameKey}
              ref={gameRef}
              drawCount={1}
              onScore={handleScore}
              onGameOver={handleGameOver}
              onMeta={setMeta}
            />
          ) : (
            <Spider
              key={gameKey}
              ref={gameRef}
              suits={variant}
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
      </div>
    </GameShell>
  );
}
