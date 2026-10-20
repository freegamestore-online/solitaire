import { StrictMode, createRef } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Game, type GameHandle } from "./Game";

vi.mock("@freegamestore/games", () => ({
  useGameSounds: () => ({ playMove: vi.fn(), playScore: vi.fn(), playClear: vi.fn() }),
}));

describe("Klondike under StrictMode", () => {
  it("counts one stock click and one undo once each", async () => {
    const ref = createRef<GameHandle>();
    let meta = { moves: 0, time: "0:00", canUndo: false };
    const { container } = render(
      <StrictMode>
        <Game drawCount={1} ref={ref} onScore={() => undefined} onGameOver={() => undefined} onMeta={(next) => { meta = next; }} />
      </StrictMode>,
    );

    fireEvent.click(container.querySelector("[data-card]")!);
    await waitFor(() => expect(meta.moves).toBe(1));
    act(() => ref.current?.undo());
    await waitFor(() => expect(meta.moves).toBe(2));
  });
});
