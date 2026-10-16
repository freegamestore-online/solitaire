import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useGameSounds } from "@freegamestore/games";
import { CARD_H, CARD_W, CardView, EmptySlot, type GameHandle } from "./Game";
import {
  POSITIONS,
  TRIPEAKS_SIZE,
  applyTriPeaks,
  isPeakAvailable,
  isTriPeaksWon,
  dealTriPeaks,
  type TriPeaksState,
} from "../lib/tripeaks";

interface Props {
  /** The solvable deal to play. App picks it, so the same number always gives the same deal. */
  dealNumber: number;
  onScore: (score: number) => void;
  onGameOver: () => void;
  onMeta?: (m: { moves: number; time: string; canUndo: boolean }) => void;
}

/** Half-card grid: one x step is half a card, so neighbouring rows overlap. */
const STEP_X = CARD_W / 2;
const ROW_Y = [0, 70, 140, 210];
const STOCK_Y = 330;

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

/**
 * TriPeaks. Tap a peak card that is free and whose rank is a neighbour of the waste
 * card to play it. Tap the stock pile to turn over the next card. Streak counts plays
 * since the last turn-over.
 */
export const TriPeaks = forwardRef<GameHandle, Props>(function TriPeaks({ dealNumber, onScore, onGameOver, onMeta }, ref) {
  const sounds = useGameSounds();
  const [state, setState] = useState<TriPeaksState>(() => dealTriPeaks(dealNumber));
  const [history, setHistory] = useState<TriPeaksState[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wonRef = useRef(false);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    onScore(state.score);
  }, [state.score, onScore]);

  useEffect(() => {
    if (isTriPeaksWon(state) && !wonRef.current) {
      wonRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver();
    }
  }, [state, onGameOver]);

  useEffect(() => {
    onMeta?.({ moves, time: formatTime(elapsed), canUndo: history.length > 0 });
  }, [moves, elapsed, history.length, onMeta]);

  const apply = (next: TriPeaksState, play: boolean) => {
    setHistory((h) => [...h, state]);
    setState(next);
    setMoves((m) => m + 1);
    if (play) sounds.playMove();
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setState(prev);
    setMoves((m) => m + 1);
  };

  useImperativeHandle(ref, () => ({ undo }), [history, state]);

  const handlePlay = (i: number) => {
    const next = applyTriPeaks(state, { type: "play", i });
    if (next) apply(next, true);
  };

  const handleDraw = () => {
    const next = applyTriPeaks(state, { type: "draw" });
    if (next) apply(next, false);
  };

  const boardWidth = 19 * STEP_X + CARD_W;

  return (
    <div className="w-full h-full overflow-auto">
      <div style={{ position: "relative", width: boardWidth, minHeight: STOCK_Y + CARD_H + 24, margin: "0 auto", padding: 8 }}>
        {POSITIONS.map(({ row, x }, i) => {
          if (state.removed[i]) return null;
          const available = isPeakAvailable(state, i);
          return (
            <CardView
              key={`${state.tableau[i]!.value}-${state.tableau[i]!.suit}`}
              card={state.tableau[i]!}
              style={{ left: x * STEP_X, top: ROW_Y[row]!, zIndex: row * 20 + i, opacity: available ? 1 : 0.55 }}
              onClick={available ? () => handlePlay(i) : undefined}
            />
          );
        })}

        {/* Stock and waste, below the peaks */}
        {state.drawn < state.stock.length ? (
          <CardView
            card={{ ...state.stock[state.drawn]!, faceUp: false }}
            style={{ left: 0, top: STOCK_Y }}
            onClick={handleDraw}
          />
        ) : (
          <EmptySlot style={{ position: "absolute", left: 0, top: STOCK_Y }} onClick={undefined} />
        )}
        <CardView card={state.waste} style={{ left: CARD_W + 16, top: STOCK_Y, zIndex: 50 }} />
        <span className="text-xs font-bold" style={{ position: "absolute", left: 2 * (CARD_W + 16), top: STOCK_Y + 36, color: "var(--success)" }}>
          Streak {state.streak} · Left {TRIPEAKS_SIZE - state.removed.filter(Boolean).length}
        </span>
      </div>
    </div>
  );
});
