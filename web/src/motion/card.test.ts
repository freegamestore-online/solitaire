import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LIFT_CLASS, CASCADE_STEP_MS, SNAP_MS, cascadeDelay, dropCard, liftCard, snapCard } from "./card";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("card motion", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
    stubReducedMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("liftCard / dropCard", () => {
    it("adds the lift class and removes it on drop", () => {
      liftCard(el);
      expect(el.classList.contains(LIFT_CLASS)).toBe(true);
      dropCard(el);
      expect(el.classList.contains(LIFT_CLASS)).toBe(false);
    });

    it("does not lift under reduced motion", () => {
      stubReducedMotion(true);
      liftCard(el);
      expect(el.classList.contains(LIFT_CLASS)).toBe(false);
    });

    it("dropping a card that was never lifted is safe", () => {
      expect(() => dropCard(el)).not.toThrow();
    });
  });

  describe("snapCard", () => {
    it("animates the scale and clears it when the snap ends", () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
      vi.stubGlobal("cancelAnimationFrame", () => {});

      snapCard(el);
      frames.shift()!(0);
      expect(el.style.transform).toMatch(/^scale\(/);

      frames.shift()!(SNAP_MS);
      expect(el.style.transform).toBe("");
    });

    it("does nothing under reduced motion", () => {
      stubReducedMotion(true);
      const raf = vi.fn();
      vi.stubGlobal("requestAnimationFrame", raf);
      snapCard(el);
      expect(raf).not.toHaveBeenCalled();
      expect(el.style.transform).toBe("");
    });

    it("cancel clears the transform", () => {
      vi.stubGlobal("requestAnimationFrame", () => 1);
      vi.stubGlobal("cancelAnimationFrame", () => {});
      const cancel = snapCard(el);
      el.style.transform = "scale(0.95)";
      cancel();
      expect(el.style.transform).toBe("");
    });
  });

  describe("cascadeDelay", () => {
    it("staggers by CASCADE_STEP_MS per card", () => {
      expect(cascadeDelay(0)).toBe(0);
      expect(cascadeDelay(1)).toBe(CASCADE_STEP_MS);
      expect(cascadeDelay(4)).toBe(4 * CASCADE_STEP_MS);
    });

    it("is 0 for every card under reduced motion", () => {
      stubReducedMotion(true);
      expect(cascadeDelay(3)).toBe(0);
    });
  });
});
