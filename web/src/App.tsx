import { useState, useCallback, useRef } from "react";
import { GameShell, GameTopbar, GameAuth } from "@freegamestore/games";
import { Game, type GameHandle } from "./components/Game";
import { useLeaderboard } from '@freegamestore/games';
import { Celebration, ParticleLayer, type ParticleLayerHandle } from "./feel";
import type { GamePhase } from "./types";

const BEST_SCORE_KEY = "freesolitaire-best";
const WIN_COLOURS = ["#16a34a", "#2563eb", "#d97706"];

function getBestScore(): number {
  const v = localStorage.getItem(BEST_SCORE_KEY);
  return v ? parseInt(v, 10) : 0;
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(getBestScore);
  const [gameKey, setGameKey] = useState(0);
  const [meta, setMeta] = useState({ moves: 0, time: "0:00", canUndo: false });
  const scoreRef = useRef(0);
  const gameRef = useRef<GameHandle>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const particleRef = useRef<ParticleLayerHandle>(null);
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const { submitScore } = useLeaderboard("solitaire");

  const handleScore = useCallback((s: number) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleGameOver = useCallback(() => {
    const final = scoreRef.current;
    const best = getBestScore();
    if (final > best) {
      localStorage.setItem(BEST_SCORE_KEY, String(final));
      setBestScore(final);
    }
    submitScore(final);
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
  }, [submitScore]);

  const endCelebration = useCallback(() => setCelebrationId(null), []);

  const start = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, []);

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
          rules={
            <div>
              <h3 style={{ fontWeight: 700 }}>Klondike Solitaire</h3>
              <h4 style={{ fontWeight: 600 }}>Rules</h4>
              <ul><li>Build foundation piles from Ace to King by suit</li><li>Tableau builds down in alternating colors</li></ul>
              <h4 style={{ fontWeight: 600 }}>Controls</h4>
              <ul><li>Tap to select a card, tap to place it</li><li>Draw 1 or Draw 3 mode available</li></ul>
            </div>
          }
        />
      }
    >
      <div ref={boardRef} className="relative w-full h-full">
        <Game
          key={gameKey}
          ref={gameRef}
          drawCount={1}
          onScore={handleScore}
          onGameOver={handleGameOver}
          onMeta={setMeta}
        />
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
              onClick={start}
              className="px-6 py-3 rounded-xl font-semibold min-h-[2.75rem]"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
}
