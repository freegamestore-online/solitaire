export const DRAW_MODE_KEY = "freesolitaire-draw";
export type DrawMode = 1 | 3;

export function parseDrawMode(value: string | null): DrawMode {
  return value === "3" ? 3 : 1;
}

export function loadDrawMode(storage: Pick<Storage, "getItem">): DrawMode {
  return parseDrawMode(storage.getItem(DRAW_MODE_KEY));
}

export function saveDrawMode(storage: Pick<Storage, "setItem">, mode: DrawMode): void {
  storage.setItem(DRAW_MODE_KEY, String(mode));
}
