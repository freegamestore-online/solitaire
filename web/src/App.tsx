import { useState, useCallback, useRef } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { Game } from "./components/Game";
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
  }, [submitScore]);

  const start = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, []);

  const drawCount = difficulty === "draw1" ? 1 : 3;

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Solitaire"
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Best", value: bestScore },
          ]}
          actions={<button onClick={start}>New Game</button>}
        />
      }
    >
      <div className="relative w-full h-full">
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
            <div className="flex gap-2">
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
    </GameShell>
  );
}
