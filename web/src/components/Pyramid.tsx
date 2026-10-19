import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useGameSounds } from "@freegamestore/games";
import { CARD_H, CARD_W, CardView, EmptySlot, type GameHandle } from "./Game";
import {
  applyPyramid,
  dealPyramid,
  isAvailable,
  isPyramidWon,
  type PyramidSource,
  type PyramidState,
} from "../lib/pyramid";

interface Props {
  /** The solvable deal to play. App picks it, so the same number always gives the same deal. */
  dealNumber: number;
  onScore: (score: number) => void;
  onGameOver: () => void;
  onMeta?: (m: { moves: number; time: string; canUndo: boolean }) => void;
}

const GAP = 8;
const STEP_X = CARD_W + GAP;
const ROW_STEP = 50;
const BOARD_W = 6 * STEP_X + CARD_W;
const STOCK_Y = 7 * ROW_STEP + 24;

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

/** Left edge of pyramid card `i`: each row is centred, so the apex sits over the middle. */
function pyramidXY(i: number): { x: number; y: number } {
  let row = 0;
  while ((row + 1) * (row + 2) / 2 <= i) row++;
  const p = i - (row * (row + 1)) / 2;
  const rowWidth = row * STEP_X + CARD_W;
  return { x: (BOARD_W - rowWidth) / 2 + p * STEP_X, y: row * ROW_STEP };
}

const sameSource = (a: PyramidSource | null, b: PyramidSource): boolean =>
  a !== null && (a.type === b.type && (a.type === "waste" || (b.type === "pyr" && a.i === b.i)));

/**
 * Pyramid. Tap a free card worth 13 (a King) to remove it. Otherwise tap two free cards,
 * or a free card and the waste top, that add up to 13. Tap the stock to turn over a card.
 */
export const Pyramid = forwardRef<GameHandle, Props>(function Pyramid({ dealNumber, onScore, onGameOver, onMeta }, ref) {
  const sounds = useGameSounds();
  const [state, setState] = useState<PyramidState>(() => dealPyramid(dealNumber));
  const [history, setHistory] = useState<PyramidState[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<PyramidSource | null>(null);
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
    if (isPyramidWon(state) && !wonRef.current) {
      wonRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver();
    }
  }, [state, onGameOver]);

  useEffect(() => {
    onMeta?.({ moves, time: formatTime(elapsed), canUndo: history.length > 0 });
  }, [moves, elapsed, history.length, onMeta]);

  const apply = (next: PyramidState) => {
    setHistory((h) => [...h, state]);
    setState(next);
    setMoves((m) => m + 1);
    setPending(null);
    sounds.playScore();
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setState(prev);
    setMoves((m) => m + 1);
    setPending(null);
  };

  useImperativeHandle(ref, () => ({ undo }), [history, state]);

  /** Tap a card: a King goes alone, otherwise it pairs with the pending card, otherwise it becomes pending. */
  const tap = (source: PyramidSource) => {
    const next = applyPyramid(state, { type: "king", from: source });
    if (next) return apply(next);
    if (pending && !sameSource(pending, source)) {
      const paired = applyPyramid(state, { type: "pair", a: pending, b: source });
      if (paired) return apply(paired);
    }
    setPending(sameSource(pending, source) ? null : source);
  };

  const handleDraw = () => {
    const next = applyPyramid(state, { type: "draw" });
    if (next) {
      setHistory((h) => [...h, state]);
      setState(next);
      setMoves((m) => m + 1);
      setPending(null);
      sounds.playMove();
    }
  };

  const boardHeight = STOCK_Y + CARD_H + 24;
  const wasteTop = state.waste[state.waste.length - 1];

  return (
    <div className="w-full h-full overflow-auto">
      <div style={{ position: "relative", width: BOARD_W, minHeight: boardHeight, margin: "0 auto", padding: 8 }}>
        {state.pyramid.map((card, i) => {
          if (state.removed[i]) return null;
          const { x, y } = pyramidXY(i);
          const free = isAvailable(state, i);
          return (
            <CardView
              key={`${card.value}-${card.suit}`}
              card={card}
              style={{ left: x, top: y, zIndex: i + 10, opacity: free ? 1 : 0.55 }}
              selected={pending?.type === "pyr" && pending.i === i}
              onClick={free ? () => tap({ type: "pyr", i }) : undefined}
            />
          );
        })}

        {state.stock.length > 0 ? (
          <CardView testId="stock-pile" card={{ ...state.stock[0]!, faceUp: false }} style={{ left: 0, top: STOCK_Y }} onClick={handleDraw} />
        ) : state.waste.length > 0 ? (
          <EmptySlot testId="stock-pile" style={{ position: "absolute", left: 0, top: STOCK_Y }} label="&#x21bb;" onClick={handleDraw} />
        ) : (
          <EmptySlot testId="stock-pile" style={{ position: "absolute", left: 0, top: STOCK_Y }} />
        )}
        {wasteTop ? (
          <CardView
            card={wasteTop}
            style={{ left: STEP_X, top: STOCK_Y, zIndex: 50 }}
            selected={pending?.type === "waste"}
            onClick={() => tap({ type: "waste" })}
          />
        ) : (
          <EmptySlot style={{ position: "absolute", left: STEP_X, top: STOCK_Y }} />
        )}
        <span className="text-xs font-bold" style={{ position: "absolute", left: 3 * STEP_X, top: STOCK_Y + 36, color: "var(--success)" }}>
          Streak {state.streak} · Left {state.removed.filter((r) => !r).length}
        </span>
      </div>
    </div>
  );
});
