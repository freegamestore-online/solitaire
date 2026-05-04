import { useState, useCallback, useRef } from "react";
import { Shell } from "./components/Shell";
import { Game } from "./components/Game";
import { Leaderboard } from "./components/Leaderboard";
import { useLeaderboard } from "./hooks/useLeaderboard";
import type { GamePhase, Difficulty } from "./types";

const BEST_SCORE_KEY = "freesolitaire-best";

function getBestScore(): number {
  const v = localStorage.getItem(BEST_SCORE_KEY);
  return v ? parseInt(v, 10) : 0;
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(getBestScore);
  const [difficulty, setDifficulty] = useState<Difficulty>("draw1");
  const [gameKey, setGameKey] = useState(0);
  const scoreRef = useRef(0);
  const { topScores, recentScores, submitScore, loading } = useLeaderboard("solitaire");

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
  }, [submitScore]);

  const start = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, []);

  const drawCount = difficulty === "draw1" ? 1 : 3;

  return (
    <Shell
      sidebar={
        <nav className="flex-1 px-4 flex flex-col gap-3 py-4 overflow-auto">
          <div className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
            Score
          </div>
          <div
            className="text-3xl font-bold"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {score}
          </div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Best: {bestScore}
          </div>

          {/* Difficulty selector */}
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              Difficulty
            </div>
            <div className="flex gap-1">
              {([["draw1", "Draw 1"], ["draw3", "Draw 3"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className="px-3 py-1 text-xs font-semibold rounded-lg"
                  style={{
                    background: difficulty === key ? "var(--accent)" : "transparent",
                    color: difficulty === key ? "#fff" : "var(--muted)",
                    border: difficulty === key ? "none" : "1px solid var(--line)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={start}
            className="mt-2 px-4 py-2 rounded-xl font-semibold text-sm"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            New Game
          </button>

          <div
            className="mt-2 border-t"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="text-xs font-semibold px-4 pt-3" style={{ color: "var(--muted)" }}>
              Leaderboard
            </div>
            <Leaderboard topScores={topScores} recentScores={recentScores} loading={loading} />
          </div>
        </nav>
      }
      dock={
        <>
          <div className="text-sm font-semibold">
            Score: {score}
          </div>
          <button
            onClick={start}
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            New
          </button>
        </>
      }
    >
      <div className="relative w-full h-full min-h-[400px]">
        {phase === "playing" ? (
          <Game
            key={gameKey}
            drawCount={drawCount}
            onScore={handleScore}
            onGameOver={handleGameOver}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <h1
              className="text-4xl font-bold"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              Solitaire
            </h1>
            {phase === "won" && (
              <p
                className="text-xl font-bold"
                style={{ color: "var(--success)", fontFamily: "Fraunces, serif" }}
              >
                You Won! Score: {score}
              </p>
            )}
            <p style={{ color: "var(--muted)" }}>
              Classic Klondike Solitaire. Tap to select, tap to place.
            </p>
            <div className="flex gap-2 md:hidden">
              {([["draw1", "Draw 1"], ["draw3", "Draw 3"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className="px-4 py-2 rounded-xl font-semibold text-sm"
                  style={{
                    background: difficulty === key ? "var(--accent)" : "transparent",
                    color: difficulty === key ? "#fff" : "var(--muted)",
                    border: difficulty === key ? "none" : "1px solid var(--line)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={start}
              className="px-6 py-3 rounded-xl font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {phase === "menu" ? "Start Game" : "Play Again"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
