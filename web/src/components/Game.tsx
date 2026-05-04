import { useState, useCallback, useEffect, useRef } from "react";
import {
  type Card,
  type Suit,
  SUIT_SYMBOLS,
  isRed,
  valueIndex,
  createDeck,
  shuffleDeck,
  cardId,
} from "../lib/cards";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GameState {
  tableau: Card[][];    // 7 columns
  foundations: Card[][]; // 4 piles (one per suit order: hearts, diamonds, clubs, spades)
  stock: Card[];
  waste: Card[];
}

interface MoveHistoryEntry {
  prev: GameState;
}

type Location =
  | { type: "tableau"; col: number; cardIndex: number }
  | { type: "waste" }
  | { type: "foundation"; pile: number };

interface Props {
  drawCount: number;
  onScore: (score: number) => void;
  onGameOver: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cloneState(s: GameState): GameState {
  return {
    tableau: s.tableau.map((col) => col.map((c) => ({ ...c }))),
    foundations: s.foundations.map((p) => p.map((c) => ({ ...c }))),
    stock: s.stock.map((c) => ({ ...c })),
    waste: s.waste.map((c) => ({ ...c })),
  };
}

function initGame(): GameState {
  const deck = shuffleDeck(createDeck());
  const tableau: Card[][] = [];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    const pile: Card[] = [];
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[idx]!, faceUp: row === col };
      pile.push(card);
      idx++;
    }
    tableau.push(pile);
  }
  const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));
  return { tableau, foundations: [[], [], [], []], stock, waste: [] };
}

function canPlaceOnTableau(card: Card, column: Card[]): boolean {
  if (column.length === 0) return card.value === "K";
  const top = column[column.length - 1]!;
  return (
    isRed(card.suit) !== isRed(top.suit) &&
    valueIndex(card.value) === valueIndex(top.value) - 1
  );
}

function canPlaceOnFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.value === "A";
  const top = pile[pile.length - 1]!;
  return card.suit === top.suit && valueIndex(card.value) === valueIndex(top.value) + 1;
}

function allFaceUp(state: GameState): boolean {
  for (const col of state.tableau) {
    for (const card of col) {
      if (!card.faceUp) return false;
    }
  }
  return state.stock.length === 0 && state.waste.length === 0;
}

function isWon(state: GameState): boolean {
  return state.foundations.every((p) => p.length === 13);
}

/* ------------------------------------------------------------------ */
/*  Card Component                                                     */
/* ------------------------------------------------------------------ */

const CARD_W = 72;
const CARD_H = 100;
const FACE_DOWN_COLOR = "#2563eb";

function CardView({
  card,
  style,
  selected,
  onClick,
}: {
  card: Card;
  style?: React.CSSProperties;
  selected?: boolean;
  onClick?: () => void;
}) {
  const color = isRed(card.suit) ? "#dc2626" : "var(--ink)";
  const symbol = SUIT_SYMBOLS[card.suit];

  if (!card.faceUp) {
    return (
      <div
        onClick={onClick}
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 8,
          border: "2px solid var(--line-strong)",
          background: FACE_DOWN_COLOR,
          position: "absolute",
          cursor: onClick ? "pointer" : "default",
          userSelect: "none",
          WebkitUserSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <div
          style={{
            width: CARD_W - 16,
            height: CARD_H - 16,
            borderRadius: 4,
            border: "2px solid rgba(255,255,255,0.3)",
            background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 8,
        border: selected
          ? "3px solid var(--accent)"
          : "2px solid var(--line-strong)",
        background: "var(--paper)",
        position: "absolute",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        WebkitUserSelect: "none",
        boxShadow: selected ? "0 0 0 2px var(--accent)" : "0 1px 3px rgba(0,0,0,0.12)",
        padding: 4,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        ...style,
      }}
    >
      <div style={{ color, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
        {card.value}
        <br />
        {symbol}
      </div>
      <div
        style={{
          color,
          fontSize: 28,
          textAlign: "center",
          lineHeight: 1,
          marginTop: -8,
        }}
      >
        {symbol}
      </div>
      <div
        style={{
          color,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
          alignSelf: "flex-end",
          transform: "rotate(180deg)",
        }}
      >
        {card.value}
        <br />
        {symbol}
      </div>
    </div>
  );
}

function EmptySlot({
  label,
  style,
  onClick,
  highlight,
}: {
  label?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 8,
        border: highlight
          ? "3px solid var(--accent)"
          : "2px dashed var(--line-strong)",
        background: highlight ? "rgba(37,99,235,0.1)" : "transparent",
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        ...style,
      }}
    >
      {label && (
        <span style={{ color: "var(--muted)", fontSize: 20 }}>{label}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Game Component                                                */
/* ------------------------------------------------------------------ */

export function Game({ drawCount, onScore, onGameOver }: Props) {
  const [state, setState] = useState<GameState>(initGame);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<MoveHistoryEntry[]>([]);
  const [selected, setSelected] = useState<Location | null>(null);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wonRef = useRef(false);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Report score continuously
  useEffect(() => {
    const score = Math.max(0, 10000 - moves * 10 - elapsed);
    onScore(score);
  }, [moves, elapsed, onScore]);

  // Win detection
  useEffect(() => {
    if (isWon(state) && !wonRef.current) {
      wonRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      onGameOver();
    }
  }, [state, onGameOver]);

  // Auto-complete
  useEffect(() => {
    if (!autoCompleting) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        const next = cloneState(prev);
        // Try to move one card to foundation
        // Check waste first
        if (next.waste.length > 0) {
          const card = next.waste[next.waste.length - 1]!;
          for (let f = 0; f < 4; f++) {
            if (canPlaceOnFoundation(card, next.foundations[f]!)) {
              next.foundations[f]!.push({ ...card, faceUp: true });
              next.waste.pop();
              setMoves((m) => m + 1);
              return next;
            }
          }
        }
        // Check tableau columns
        for (let c = 0; c < 7; c++) {
          const col = next.tableau[c]!;
          if (col.length === 0) continue;
          const card = col[col.length - 1]!;
          for (let f = 0; f < 4; f++) {
            if (canPlaceOnFoundation(card, next.foundations[f]!)) {
              next.foundations[f]!.push({ ...card, faceUp: true });
              col.pop();
              setMoves((m) => m + 1);
              return next;
            }
          }
        }
        // Nothing to move — done
        setAutoCompleting(false);
        return prev;
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [autoCompleting, state]);

  // Check for auto-complete eligibility after each move
  useEffect(() => {
    if (!autoCompleting && !wonRef.current && allFaceUp(state)) {
      setAutoCompleting(true);
    }
  }, [state, autoCompleting]);

  const pushHistory = useCallback(
    (s: GameState) => {
      setHistory((h) => [...h, { prev: cloneState(s) }]);
    },
    [],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!.prev;
      setState(prev);
      setMoves((m) => m + 1);
      return h.slice(0, -1);
    });
  }, []);

  /* ---- Stock click ---- */
  const drawFromStock = useCallback(() => {
    setSelected(null);
    setState((prev) => {
      pushHistory(prev);
      const next = cloneState(prev);
      if (next.stock.length === 0) {
        // Reset: waste back to stock (reversed)
        next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
        next.waste = [];
      } else {
        const count = Math.min(drawCount, next.stock.length);
        for (let i = 0; i < count; i++) {
          const card = next.stock.pop()!;
          card.faceUp = true;
          next.waste.push(card);
        }
      }
      setMoves((m) => m + 1);
      return next;
    });
  }, [drawCount, pushHistory]);

  /* ---- Selection / move logic (two-tap) ---- */
  const tryMove = useCallback(
    (from: Location, to: Location) => {
      setState((prev) => {
        const next = cloneState(prev);
        let cards: Card[] = [];

        // Get cards from source
        if (from.type === "waste") {
          if (next.waste.length === 0) return prev;
          cards = [next.waste[next.waste.length - 1]!];
        } else if (from.type === "tableau") {
          const col = next.tableau[from.col]!;
          if (from.cardIndex < 0 || from.cardIndex >= col.length) return prev;
          cards = col.slice(from.cardIndex);
        } else if (from.type === "foundation") {
          const pile = next.foundations[from.pile]!;
          if (pile.length === 0) return prev;
          cards = [pile[pile.length - 1]!];
        }

        if (cards.length === 0) return prev;
        const movingCard = cards[0]!;

        // Try to place on destination
        if (to.type === "tableau") {
          const destCol = next.tableau[to.col]!;
          if (!canPlaceOnTableau(movingCard, destCol)) return prev;
          // Only single cards from waste/foundation
          if (from.type === "waste" || from.type === "foundation") {
            if (cards.length > 1) return prev;
          }
          // Remove from source
          if (from.type === "waste") {
            next.waste.pop();
          } else if (from.type === "tableau") {
            next.tableau[from.col] = next.tableau[from.col]!.slice(0, from.cardIndex);
            // Flip new top card
            const srcCol = next.tableau[from.col]!;
            if (srcCol.length > 0 && !srcCol[srcCol.length - 1]!.faceUp) {
              srcCol[srcCol.length - 1]!.faceUp = true;
            }
          } else if (from.type === "foundation") {
            next.foundations[from.pile]!.pop();
          }
          // Add to destination
          for (const c of cards) {
            destCol.push({ ...c, faceUp: true });
          }
        } else if (to.type === "foundation") {
          // Only single cards to foundation
          if (cards.length > 1) return prev;
          const destPile = next.foundations[to.pile]!;
          if (!canPlaceOnFoundation(movingCard, destPile)) return prev;
          // Remove from source
          if (from.type === "waste") {
            next.waste.pop();
          } else if (from.type === "tableau") {
            next.tableau[from.col] = next.tableau[from.col]!.slice(0, from.cardIndex);
            const srcCol = next.tableau[from.col]!;
            if (srcCol.length > 0 && !srcCol[srcCol.length - 1]!.faceUp) {
              srcCol[srcCol.length - 1]!.faceUp = true;
            }
          } else if (from.type === "foundation") {
            next.foundations[from.pile]!.pop();
          }
          destPile.push({ ...movingCard, faceUp: true });
        } else {
          return prev;
        }

        pushHistory(prev);
        setMoves((m) => m + 1);
        return next;
      });
      setSelected(null);
    },
    [pushHistory],
  );

  /* ---- Auto-move to foundation on double-tap / single card ---- */
  const tryAutoFoundation = useCallback(
    (from: Location): boolean => {
      let card: Card | null = null;
      let isSingleCard = false;

      if (from.type === "waste") {
        if (state.waste.length > 0) {
          card = state.waste[state.waste.length - 1]!;
          isSingleCard = true;
        }
      } else if (from.type === "tableau") {
        const col = state.tableau[from.col]!;
        if (from.cardIndex === col.length - 1 && col.length > 0) {
          card = col[col.length - 1]!;
          isSingleCard = true;
        }
      }

      if (!card || !isSingleCard) return false;

      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(card, state.foundations[f]!)) {
          tryMove(from, { type: "foundation", pile: f });
          return true;
        }
      }
      return false;
    },
    [state, tryMove],
  );

  const handleCardClick = useCallback(
    (loc: Location) => {
      if (autoCompleting) return;

      if (selected === null) {
        // Try auto-foundation on tap of top card
        if (
          (loc.type === "waste") ||
          (loc.type === "tableau" && loc.cardIndex === (state.tableau[loc.col]?.length ?? 0) - 1)
        ) {
          // On second thought: first tap = select. Double-tap could auto-move, but
          // for reliability, just select on first tap.
        }
        setSelected(loc);
      } else {
        // Check if tapping same location — try auto-foundation
        if (
          selected.type === loc.type &&
          (selected.type === "waste" ||
            (selected.type === "tableau" && loc.type === "tableau" && selected.col === loc.col && selected.cardIndex === loc.cardIndex) ||
            (selected.type === "foundation" && loc.type === "foundation" && selected.pile === loc.pile))
        ) {
          if (tryAutoFoundation(loc)) return;
          setSelected(null);
          return;
        }
        // Try to move
        tryMove(selected, loc);
      }
    },
    [selected, state, tryMove, tryAutoFoundation, autoCompleting],
  );

  const handleEmptyTableauClick = useCallback(
    (col: number) => {
      if (autoCompleting) return;
      if (selected) {
        tryMove(selected, { type: "tableau", col, cardIndex: 0 });
      }
    },
    [selected, tryMove, autoCompleting],
  );

  const handleFoundationClick = useCallback(
    (pile: number) => {
      if (autoCompleting) return;
      if (selected) {
        tryMove(selected, { type: "foundation", pile });
      } else {
        // Select from foundation
        const p = state.foundations[pile]!;
        if (p.length > 0) {
          setSelected({ type: "foundation", pile });
        }
      }
    },
    [selected, state.foundations, tryMove, autoCompleting],
  );

  /* ---- Rendering ---- */
  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const FOUNDATION_SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
  const GAP = 8;
  const TABLEAU_OFFSET = 24;
  const TABLEAU_FACEDOWN_OFFSET = 8;
  const TOP_ROW_Y = 8;
  const TABLEAU_Y = CARD_H + TOP_ROW_Y + 16;

  // Calculate board width
  const boardWidth = 7 * CARD_W + 6 * GAP;

  const isSelected = (loc: Location) => {
    if (!selected) return false;
    if (selected.type !== loc.type) return false;
    if (selected.type === "waste" && loc.type === "waste") return true;
    if (selected.type === "tableau" && loc.type === "tableau") {
      return selected.col === loc.col && selected.cardIndex === loc.cardIndex;
    }
    if (selected.type === "foundation" && loc.type === "foundation") {
      return selected.pile === loc.pile;
    }
    return false;
  };

  const isPartOfSelection = (col: number, idx: number) => {
    if (!selected || selected.type !== "tableau") return false;
    return selected.col === col && idx >= selected.cardIndex;
  };

  return (
    <div
      className="w-full h-full flex flex-col"
      onClick={(e) => {
        // Click on empty area = deselect
        if (e.target === e.currentTarget) setSelected(null);
      }}
    >
      {/* Stats bar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-4 text-sm">
          <span>
            Moves: <b>{moves}</b>
          </span>
          <span>
            Time: <b>{formatTime(elapsed)}</b>
          </span>
        </div>
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="px-3 py-1 rounded-lg text-sm font-semibold"
          style={{
            background: history.length > 0 ? "var(--accent)" : "var(--line)",
            color: history.length > 0 ? "#fff" : "var(--muted)",
          }}
        >
          Undo
        </button>
      </div>

      {/* Board */}
      <div
        className="flex-1 overflow-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <div
          style={{
            position: "relative",
            width: boardWidth + 16,
            minHeight: 600,
            margin: "0 auto",
            padding: "8px 8px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          {/* Top row: Stock, Waste, gap, 4 Foundations */}

          {/* Stock */}
          {state.stock.length > 0 ? (
            <CardView
              card={{ ...state.stock[state.stock.length - 1]!, faceUp: false }}
              style={{ left: 0, top: TOP_ROW_Y }}
              onClick={drawFromStock}
            />
          ) : (
            <EmptySlot
              style={{ position: "absolute", left: 0, top: TOP_ROW_Y }}
              onClick={drawFromStock}
              label="&#x21bb;"
            />
          )}

          {/* Waste */}
          {state.waste.length > 0 ? (
            <>
              {/* Show up to drawCount cards fanned in waste */}
              {state.waste.slice(-(Math.min(drawCount, 3))).map((card, i, arr) => {
                const isTop = i === arr.length - 1;
                const loc: Location = { type: "waste" };
                return (
                  <CardView
                    key={cardId(card)}
                    card={card}
                    style={{
                      left: CARD_W + GAP + i * 18,
                      top: TOP_ROW_Y,
                      zIndex: i + 1,
                    }}
                    selected={isTop && isSelected(loc)}
                    onClick={isTop ? () => handleCardClick(loc) : undefined}
                  />
                );
              })}
            </>
          ) : (
            <EmptySlot
              style={{ position: "absolute", left: CARD_W + GAP, top: TOP_ROW_Y }}
            />
          )}

          {/* Foundations */}
          {FOUNDATION_SUITS.map((suit, i) => {
            const pile = state.foundations[i]!;
            const x = (3 + i) * (CARD_W + GAP);
            const loc: Location = { type: "foundation", pile: i };
            const isHighlight = selected !== null && pile.length === 0;

            if (pile.length > 0) {
              const topCard = pile[pile.length - 1]!;
              return (
                <CardView
                  key={suit}
                  card={topCard}
                  style={{ left: x, top: TOP_ROW_Y }}
                  selected={isSelected(loc)}
                  onClick={() => handleFoundationClick(i)}
                />
              );
            }
            return (
              <EmptySlot
                key={suit}
                label={SUIT_SYMBOLS[suit]}
                style={{ position: "absolute", left: x, top: TOP_ROW_Y }}
                onClick={() => handleFoundationClick(i)}
                highlight={isHighlight}
              />
            );
          })}

          {/* Tableau */}
          {state.tableau.map((col, colIdx) => {
            const x = colIdx * (CARD_W + GAP);
            if (col.length === 0) {
              const isHighlight = selected !== null;
              return (
                <EmptySlot
                  key={`tab-empty-${colIdx}`}
                  style={{ position: "absolute", left: x, top: TABLEAU_Y }}
                  onClick={() => handleEmptyTableauClick(colIdx)}
                  highlight={isHighlight}
                />
              );
            }

            // Calculate y offsets
            let yOffset = 0;
            return col.map((card, idx) => {
              const y = TABLEAU_Y + yOffset;
              yOffset += card.faceUp ? TABLEAU_OFFSET : TABLEAU_FACEDOWN_OFFSET;
              const isTop = idx === col.length - 1;
              const isFaceUp = card.faceUp;
              const loc: Location = { type: "tableau", col: colIdx, cardIndex: idx };
              const partOfSel = isPartOfSelection(colIdx, idx);
              const clickable = isFaceUp;

              return (
                <CardView
                  key={cardId(card)}
                  card={card}
                  style={{
                    left: x,
                    top: y,
                    zIndex: idx + 10,
                    transform: partOfSel ? "translateY(-4px)" : undefined,
                    transition: "transform 0.1s",
                  }}
                  selected={partOfSel && (isSelected(loc) || (selected?.type === "tableau" && selected.col === colIdx && idx >= selected.cardIndex))}
                  onClick={
                    clickable
                      ? () => handleCardClick(loc)
                      : isTop
                        ? () => handleCardClick(loc)
                        : undefined
                  }
                />
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
