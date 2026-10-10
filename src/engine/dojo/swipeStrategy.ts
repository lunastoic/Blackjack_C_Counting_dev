import { DECISION } from './training';

/**
 * Swipe Strategy — Io Inferno's level 2. A hand slides onto the felt and the
 * player swipes the book play: ← hit, → stand, ↑ double, ↓ split. A star per
 * wave of hands; fast right swipes build a combo.
 *
 * Pure TypeScript — no React / RN imports.
 */

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export const SWIPE_DIRECTIONS: readonly SwipeDirection[] = ['left', 'right', 'up', 'down'];

/** The DECISION code each swipe means. */
export const SWIPE_DECISION: Readonly<Record<SwipeDirection, number>> = {
  left: DECISION.hit,
  right: DECISION.stand,
  up: DECISION.double,
  down: DECISION.split,
};

/** How far (px) a drag has to travel before letting go counts as a swipe. */
export const SWIPE_THRESHOLD = 70;

/**
 * The swipe a released drag of `dx`, `dy` makes: the dominant axis, once past
 * `threshold`. Null when the card should snap back.
 */
export function swipeFromDrag(dx: number, dy: number, threshold = SWIPE_THRESHOLD): SwipeDirection | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < threshold) {
    return null;
  }
  if (ax >= ay) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

/** The swipe that gives a DECISION code. */
export function swipeForDecision(code: number): SwipeDirection {
  return SWIPE_DIRECTIONS.find((direction) => SWIPE_DECISION[direction] === code) ?? 'right';
}

/** Combo lengths where the shown multiplier steps up: ×2 at 3, ×3 at 6, ×4 at 10. */
export function swipeComboMultiplier(combo: number): number {
  if (combo >= 10) {
    return 4;
  }
  if (combo >= 6) {
    return 3;
  }
  return combo >= 3 ? 2 : 1;
}
