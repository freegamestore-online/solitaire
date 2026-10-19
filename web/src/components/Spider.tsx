import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useGameSounds } from "@freegamestore/games";
import { CARD_H, CARD_W, CardView, EmptySlot, type GameHandle } from "./Game";
import { seededRandom } from "../lib/random";
import {
  COLUMNS,
  RUNS_TO_WIN,
  dealFromStock,
  isRunFrom,
  isSpiderWon,
  moveRun,
  newSpiderGame,
  type SpiderState,
  type SpiderSuitCount,
} from "../lib/spider";

interface Props {
  suits: SpiderSuitCount;
  onScore: (score: number) => void;
  onGameOver: () => void;
  /** Reports moves / elapsed time / whether undo is available, for the topbar. */
  onMeta?: (m: { moves: number; time: string; canUndo: boolean }) => void;
  /** Deal from this seed, for the daily deal. Omit it for a random deal. */
  seed?: number;
}

/** A selected run: the column it sits in and the index of its top card. */
interface Selection {
  col: number;
  index: number;
}

const GAP = 8;
const TOP_ROW_Y = 8;
const TABLEAU_Y = CARD_H + TOP_ROW_Y + 16;
const FACE_DOWN_OFFSET = 8;
const FACE_UP_OFFSET = 24;

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

/**
 * Spider solitaire. Tap a face-up run to pick it up, then tap a column to drop it. Deal
 * from the stock with the pile at top left. Same interface as `Game`, so App can swap them.
 */
export const Spider = forwardRef<GameHandle, Props>(function Spider({ suits, onScore, onGameOver, onMeta, seed }, ref) {
  const sounds = useGameSounds();
  const [state, setState] = useState<SpiderState>(() => newSpiderGame(suits, seed === undefined ? undefined : seededRandom(seed)));
  const [history, setHistory] = useState<SpiderState[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<Selection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wonRef = useRef(false);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Score, as in Klondike: falls with each move and with time.
  useEffect(() => {
    onScore(Math.max(0, 10000 - moves * 10 - elapsed));
  }, [moves, elapsed, onScore]);

  // Win detection
  useEffect(() => {
    if (isSpiderWon(state) && !wonRef.current) {
      wonRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver();
    }
  }, [state, onGameOver]);

  // Surface moves / time / undo-availability to the topbar.
  useEffect(() => {
    onMeta?.({ moves, time: formatTime(elapsed), canUndo: history.length > 0 });
  }, [moves, elapsed, history.length, onMeta]);

  const apply = (next: SpiderState) => {
    setHistory((h) => [...h, state]);
    setState(next);
    setMoves((m) => m + 1);
    setSelected(null);
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setState(prev);
    setMoves((m) => m + 1);
    setSelected(null);
  };

  useImperativeHandle(ref, () => ({ undo }), [history, state]);

  /** Drop the selected run on a column. Returns true if the move was legal. */
  const dropOn = (toCol: number): boolean => {
    if (!selected) return false;
    const next = moveRun(state, selected.col, selected.index, toCol);
    if (!next) return false;
    apply(next);
    if (next.completed > state.completed) sounds.playScore();
    else sounds.playMove();
    return true;
  };

  const handleCardTap = (col: number, index: number) => {
    if (selected && selected.col !== col && dropOn(col)) return;
    if (selected && selected.col === col && selected.index === index) {
      setSelected(null);
      return;
    }
    setSelected(isRunFrom(state.tableau[col]!, index) ? { col, index } : null);
  };

  const handleEmptyTap = (col: number) => {
    if (selected) dropOn(col);
  };

  const handleDeal = () => {
    const next = dealFromStock(state);
    if (next) apply(next);
    else setSelected(null);
  };

  const boardWidth = COLUMNS * CARD_W + (COLUMNS - 1) * GAP;
  const cardX = (col: number) => col * (CARD_W + GAP);
  const inSelection = (col: number, index: number) =>
    selected !== null && selected.col === col && index >= selected.index;

  return (
    <div
      className="w-full h-full flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
    >
      <div
        className="flex-1 overflow-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <div
          style={{ position: "relative", width: boardWidth + 16, minHeight: 600, margin: "0 auto", padding: "8px 8px" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          {/* Top row: stock pile, deals left, runs completed */}
          {state.stock.length > 0 ? (
            <CardView
              card={{ ...state.stock[state.stock.length - 1]!, faceUp: false }}
              testId="stock-pile"
              style={{ left: cardX(0), top: TOP_ROW_Y }}
              onClick={handleDeal}
            />
          ) : (
            <EmptySlot testId="stock-pile" style={{ position: "absolute", left: cardX(0), top: TOP_ROW_Y }} />
          )}
          <span
            className="text-xs font-bold"
            style={{ position: "absolute", left: cardX(1), top: TOP_ROW_Y + 36, color: "var(--muted)" }}
          >
            Deals left: {state.stock.length / COLUMNS}
          </span>
          <span
            className="text-xs font-bold"
            style={{ position: "absolute", left: cardX(7), top: TOP_ROW_Y + 36, color: "var(--success)" }}
          >
            Runs {state.completed}/{RUNS_TO_WIN}
          </span>

          {/* Tableau */}
          {state.tableau.map((column, col) => {
            if (column.length === 0) {
              return (
                <EmptySlot
                  key={`empty-${col}`}
                  style={{ position: "absolute", left: cardX(col), top: TABLEAU_Y }}
                  onClick={() => handleEmptyTap(col)}
                  highlight={selected !== null}
                />
              );
            }
            let y = TABLEAU_Y;
            return column.map((card, index) => {
              const top = y;
              y += card.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
              return (
                <CardView
                  key={card.uid}
                  card={card}
                  style={{ left: cardX(col), top, zIndex: index + 10 }}
                  selected={card.faceUp && inSelection(col, index)}
                  onClick={card.faceUp ? () => handleCardTap(col, index) : () => handleEmptyTap(col)}
                />
              );
            });
          })}
        </div>
      </div>
    </div>
  );
});
