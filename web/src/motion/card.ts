import { easeOutBack } from "./easing";
import { prefersReducedMotion } from "./reducedMotion";
import { tweenProgress, tweenValue } from "./tween";

/** Class that lifts a card: see `.card--lifted` in index.css. */
export const LIFT_CLASS = "card--lifted";

/** Gap between cards in the auto-complete cascade, in ms. */
export const CASCADE_STEP_MS = 60;

/** Length of the snap, in ms. */
export const SNAP_MS = 220;

/** The snap starts this much smaller than rest, then springs back to 1. */
const SNAP_FROM_SCALE = 0.92;

/** Lift a card that the player has picked up. Does nothing under reduced motion. */
export function liftCard(el: HTMLElement): void {
  if (prefersReducedMotion()) return;
  el.classList.add(LIFT_CLASS);
}

/** Put a lifted card back down. Safe to call on a card that was never lifted. */
export function dropCard(el: HTMLElement): void {
  el.classList.remove(LIFT_CLASS);
}

/**
 * Spring a card into place after it lands. Returns a cancel function. Under reduced
 * motion nothing is animated and the cancel function does nothing.
 */
export function snapCard(el: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  let started: number | null = null;
  let frame = 0;
  const step = (now: number) => {
    started ??= now;
    const elapsed = now - started;
    const scale = tweenValue(SNAP_FROM_SCALE, 1, elapsed, SNAP_MS, easeOutBack());
    el.style.transform = `scale(${scale})`;
    if (tweenProgress(elapsed, SNAP_MS) < 1) {
      frame = requestAnimationFrame(step);
    } else {
      el.style.transform = "";
    }
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    el.style.transform = "";
  };
}

/**
 * Delay before the `index`-th card in an auto-complete cascade lands, in ms.
 * Cards land one after another. Under reduced motion they all land at once.
 */
export function cascadeDelay(index: number): number {
  return prefersReducedMotion() ? 0 : index * CASCADE_STEP_MS;
}
