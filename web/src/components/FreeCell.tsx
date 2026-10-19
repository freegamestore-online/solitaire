import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useGameSounds } from "@freegamestore/games";
import { SUITS, SUIT_SYMBOLS } from "../lib/cards";
import { CARD_H, CARD_W, CardView, EmptySlot, type GameHandle } from "./Game";
import {
  CASCADES,
  FREE_CELLS,
  dealFreeCell,
  isFreeCellWon,
  isSequenceFrom,
  moveCards,
  type FreeCellState,
  type Source,
  type Target,
} from "../lib/freecell";

interface Props {
  /** The numbered deal to play. Changing it starts a new game (App remounts this component). */
  dealNumber: number;
  onScore: (score: number) => void;
  onGameOver: () => void;
  /** Reports moves / elapsed time / whether undo is available, for the topbar. */
  onMeta?: (m: { moves: number; time: string; canUndo: boolean }) => void;
}

const GAP = 8;
const TOP_ROW_Y = 8;
const TABLEAU_Y = CARD_H + TOP_ROW_Y + 16;
const CASCADE_OFFSET = 24;

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
const cardX = (col: number) => col * (CARD_W + GAP);

/**
 * FreeCell. Tap a card (or a sequence in a column) to pick it up, then tap a free cell,
 * a foundation or a column to drop it. Safe cards move to their foundations on their own.
 */
export const FreeCell = forwardRef<GameHandle, Props>(function FreeCell({ dealNumber, onScore, onGameOver, onMeta }, ref) {
  const sounds = useGameSounds();
  const [state, setState] = useState<FreeCellState>(() => dealFreeCell(dealNumber));
  const [history, setHistory] = useState<FreeCellState[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<Source | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wonRef = useRef(false);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    onScore(Math.max(0, 10000 - moves * 10 - elapsed));
  }, [moves, elapsed, onScore]);

  useEffect(() => {
    if (isFreeCellWon(state) && !wonRef.current) {
      wonRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver();
    }
  }, [state, onGameOver]);

  useEffect(() => {
    onMeta?.({ moves, time: formatTime(elapsed), canUndo: history.length > 0 });
  }, [moves, elapsed, history.length, onMeta]);

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setState(prev);
    setMoves((m) => m + 1);
    setSelected(null);
  };

  useImperativeHandle(ref, () => ({ undo }), [history, state]);

  /** Try to drop the selected cards on a target. Returns true if the move was legal. */
  const dropOn = (target: Target): boolean => {
    if (!selected) return false;
    const next = moveCards(state, selected, target);
    if (!next) return false;
    setHistory((h) => [...h, state]);
    setState(next);
    setMoves((m) => m + 1);
    setSelected(null);
    if (next.foundations.some((p, i) => p.length > state.foundations[i]!.length)) sounds.playScore();
    else sounds.playMove();
    return true;
  };

  const handleCascadeTap = (col: number, index: number) => {
    if (selected && !(selected.type === "cascade" && selected.col === col && selected.index === index)) {
      if (dropOn({ type: "cascade", col })) return;
    }
    if (selected?.type === "cascade" && selected.col === col && selected.index === index) {
      setSelected(null);
      return;
    }
    const column = state.cascades[col]!;
    setSelected(isSequenceFrom(column, index) ? { type: "cascade", col, index } : null);
  };

  const handleEmptyCascadeTap = (col: number) => {
    if (selected) dropOn({ type: "cascade", col });
  };

  const handleCellTap = (cell: number) => {
    if (selected?.type === "free" && selected.cell === cell) {
      setSelected(null);
      return;
    }
    if (selected && dropOn({ type: "free", cell })) return;
    setSelected(state.freeCells[cell] ? { type: "free", cell } : null);
  };

  const handleFoundationTap = (pile: number) => {
    if (selected) dropOn({ type: "foundation", pile });
  };

  const boardWidth = CASCADES * CARD_W + (CASCADES - 1) * GAP;
  const inSelection = (col: number, index: number) =>
    selected?.type === "cascade" && selected.col === col && index >= selected.index;

  return (
    <div
      className="w-full h-full flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
    >
      <div className="flex-1 overflow-auto">
        <div
          style={{ position: "relative", width: boardWidth + 16, minHeight: 600, margin: "0 auto", padding: "8px 8px" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          {/* Top row: four free cells, then four foundations */}
          {state.freeCells.slice(0, FREE_CELLS).map((card, cell) =>
            card ? (
              <CardView
                key={`cell-${cell}`}
                card={card}
                style={{ left: cardX(cell), top: TOP_ROW_Y }}
                selected={selected?.type === "free" && selected.cell === cell}
                onClick={() => handleCellTap(cell)}
              />
            ) : (
              <EmptySlot
                key={`cell-${cell}`}
                testId={`free-cell-${cell}`}
                style={{ position: "absolute", left: cardX(cell), top: TOP_ROW_Y }}
                onClick={() => handleCellTap(cell)}
                highlight={selected !== null}
              />
            ),
          )}
          {SUITS.map((suit, pile) => {
            const top = state.foundations[pile]![state.foundations[pile]!.length - 1];
            const x = cardX(CASCADES - 4 + pile);
            return top ? (
              <CardView
                key={`found-${suit}`}
                card={top}
                style={{ left: x, top: TOP_ROW_Y }}
                onClick={() => handleFoundationTap(pile)}
              />
            ) : (
              <EmptySlot
                key={`found-${suit}`}
                label={SUIT_SYMBOLS[suit]}
                style={{ position: "absolute", left: x, top: TOP_ROW_Y }}
                onClick={() => handleFoundationTap(pile)}
                highlight={selected !== null}
              />
            );
          })}

          {/* Cascades */}
          {state.cascades.map((column, col) => {
            if (column.length === 0) {
              return (
                <EmptySlot
                  key={`empty-${col}`}
                  style={{ position: "absolute", left: cardX(col), top: TABLEAU_Y }}
                  onClick={() => handleEmptyCascadeTap(col)}
                  highlight={selected !== null}
                />
              );
            }
            return column.map((card, index) => (
              <CardView
                key={`${card.value}-${card.suit}`}
                card={card}
                testId={col === 0 && index === column.length - 1 ? "freecell-source" : undefined}
                style={{ left: cardX(col), top: TABLEAU_Y + index * CASCADE_OFFSET, zIndex: index + 10 }}
                selected={inSelection(col, index)}
                onClick={() => handleCascadeTap(col, index)}
              />
            ));
          })}
        </div>
      </div>
    </div>
  );
});
