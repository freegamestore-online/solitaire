# Solitaire audit (#335)

Audit of the existing Klondike game before the feel and motion kit was added, plus what the kit changed. Part of #334 (epic) and #335.

## Structure

- pnpm workspace (`pnpm-workspace.yaml`) with a single package, `web/` (`@solitaire/web`).
- Root scripts: `dev`, `build`, `preview`, `typecheck` (all delegate to `web/`).
- `web/src/App.tsx` (136 lines): page shell, topbar stats, best score, leaderboard submit, win overlay, and the win burst and confetti.
- `web/src/components/Game.tsx` (834 lines): the whole game. State, move rules (`computeMove`), tap-to-select, stock and waste, auto-complete, undo history, and the board render.
- `web/src/lib/cards.ts` (49 lines): deck, shuffle, `cardId`, suit and value helpers.
- `web/src/types.ts` (3 lines): `GamePhase`, `Difficulty`.
- `web/src/components/Shell.tsx` (56 lines): an older custom shell. App no longer imports it, and the compliance test forbids that import. It is dead code.
- `web/src/feel/`, `web/src/motion/`, `web/src/hooks/`: feel and motion kit (see below).
- Deploy: `.github/workflows/deploy.yml` calls the shared `ci-workflows` game CI with `cf_project: freesolitaireapp`.

## Tests

- Framework: Vitest 4 with jsdom and Testing Library, set up in `web/src/test/setup.ts`.
- `web/src/test/compliance.test.ts` (19 tests) checks file contents: SDK imports, CSS variables, dark mode, `overflow: hidden`, the PWA plugin, and the Shell import ban.
- Kit tests, copied from sudoku: `motion/` (easing, tween, flight, reducedMotion) and `feel/` (ParticleLayer, ScorePop, particles, shake, useShake, haptics).
- `web/src/motion/card.test.ts`: the solitaire card-motion helpers (lift, drop, snap, cascade delay), including reduced-motion behaviour.
- Totals after this change: 12 test files, 77 tests, all passing. `tsc -b` and `vite build` both pass.
- Gap: **no Klondike logic tests.** `computeMove`, `canPlaceOnTableau`, `canPlaceOnFoundation`, `allFaceUp` and `isWon` are not exported, so they are untested. Deal, draw, undo and auto-complete are untested too. Adding these needs exporting the pure functions or moving them into `lib/`.
- Jsdom prints "HTMLCanvasElement's getContext() not implemented" from the copied `ParticleLayer` tests. This is noise, not a failure. The same happens in sudoku.

## Save format

- **localStorage key `freesolitaire-best`** holds the best score as a decimal string. `App.tsx` reads it with `parseInt` and writes it only when a finished game's score is higher.
- **No game-state save.** The board, moves, timer and undo history are React state. Reloading starts a new deal.
- **No migration is needed.** The best-score value has always been a plain integer, so there is no old format to read. Any future save should carry a version field from its first version.
- Feel-kit changes add no storage.

## SDK usage

- `GameShell`, `GameTopbar`, `GameAuth` from `@freegamestore/games`.
- `useLeaderboard("solitaire")` gives `submitScore`. It is called once per win, from `handleGameOver`.
- `useGameSounds()` in `Game.tsx` (`playMove`, `playScore`) and in `Celebration` (`playLevelUp`). The win sound now comes from `Celebration`, so `Game` no longer plays `playClear` on a win. Sudoku made the same change.

## Feel and motion kit

Copied from `sudoku-gh` (`web/src/motion/`, `web/src/feel/`, `web/src/hooks/useGameLoop.ts`). Sudoku's kit was itself copied from zap-drills-gh. The copied files carry `TODO` comments to switch to `@freegamestore/games/feel` once the SDK ships it.

Status, by request:

- **Card lift and shadow:** done. `liftCard` / `dropCard` in `motion/card.ts` add `.card--lifted` to the selected card or stack. The class (in `index.css`) is `translateY(-4px) scale(1.04)` with a shadow. It uses `!important` to override the existing inline selection offset.
- **Snap:** done. `snapCard` springs a card in with `easeOutBack` when a player move lands it. Auto-complete also snaps each card it lands.
- **Auto-complete cascade:** done. `cascadeDelay(index)` staggers the auto-complete snaps by 60 ms per card. Cards still move one at a time, every 150 ms, as before.
- **Win celebration:** done. `ParticleLayer` bursts from the middle of the board, and `Celebration` shows the confetti. Both are mounted in `App.tsx`.
- **Reduced motion:** done. `liftCard` and `snapCard` do nothing under `prefers-reduced-motion`. `cascadeDelay` returns 0. `ParticleLayer.burst` and `Celebration`'s confetti follow the kit's own guards. The existing win overlay and banner stay as they were.

Copied but not used:

- `ScorePop`: the score only falls (`10000 − 10·moves − seconds`), so there is no "score increased" moment to pop on. Wire it when the scoring changes.
- `flyWord`, `shake`/`useShake`, `haptics`/`useHaptics`: no caller yet.
- The region-shimmer CSS (`.region-shimmer`) is copied with the rest of the kit's CSS. Nothing applies it.

Behaviour notes:

- There is no drag in solitaire. Moves are tap-to-select then tap-to-place. So "drag start and end" maps to picking up and dropping the selection.

## Gaps and follow-ups

- Klondike logic has no tests (see Tests above).
- `Shell.tsx` is dead code. Delete it in a later cleanup.
- `web/tsconfig.app.tsbuildinfo` is tracked, and `tsc -b` rewrites it on every run. It should be untracked or ignored.
- The epic's Spider, FreeCell, TriPeaks and Pyramid modes are not started. Their tickets are separate.
