import { describe, expect, it } from "vitest";
import { DRAW_MODE_KEY, loadDrawMode, parseDrawMode, saveDrawMode } from "./drawMode";

describe("Klondike draw preference", () => {
  it("defaults to Draw 1 and only accepts the saved Draw 3 value", () => {
    expect(parseDrawMode(null)).toBe(1);
    expect(parseDrawMode("other")).toBe(1);
    expect(parseDrawMode("3")).toBe(3);
  });

  it("loads and saves the preference in local storage", () => {
    const storage = window.localStorage;
    storage.removeItem(DRAW_MODE_KEY);
    expect(loadDrawMode(storage)).toBe(1);
    saveDrawMode(storage, 3);
    expect(storage.getItem(DRAW_MODE_KEY)).toBe("3");
    expect(loadDrawMode(storage)).toBe(3);
  });
});
