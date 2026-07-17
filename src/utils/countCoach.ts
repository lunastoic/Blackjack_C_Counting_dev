import { CountCoachLevel } from '../engine/types';

/**
 * Count Coach — the single dial for counting help at the table.
 *
 * Off   → pure casino play, no aids.
 * Learn → play normally while the coach silently tracks the Hi-Lo count and
 *         pops a "what's the count?" check after rounds (see the learn
 *         helpers below). This is where players actually learn to count.
 * Full  → the old Training Mode kit: live running/true counts, the vertical
 *         count rail, training card skin, underglow, hints, drills, charts.
 */
export interface CountCoachCapabilities {
  readonly level: CountCoachLevel;
  /** Live running / true count + cards left, plus the vertical count rail (Full). */
  readonly showLiveCounts: boolean;
  /** Hi-Lo underglow on dealt cards (Full, with the underglow toggle). */
  readonly showCardValueGlow: boolean;
  /** Card faces printed with their Hi-Lo values (Full). */
  readonly useTrainingSkin: boolean;
  /** Post-round multiple-choice count checks (Learn). */
  readonly showCountCheck: boolean;
  /** Strategy chart/hints, distribution charts, count pulse, autoplay drill (Full). */
  readonly allowFullTools: boolean;
  /** Cut-card marker + shoe progress on the piles (all levels). */
  readonly showShoeProgress: boolean;
}

export const COUNT_COACH_LABELS: Record<CountCoachLevel, string> = {
  off: 'Off',
  learn: 'Learn',
  full: 'Full',
};

export const COUNT_COACH_BLURBS: Record<CountCoachLevel, string> = {
  off: 'Pure casino play — counts stay hidden. Just you and the shoe.',
  learn: 'Play normal blackjack while the coach quizzes you on the count after rounds. Miss and it checks in more often; nail it and it backs off.',
  full: 'Every tool live: running / true count, Hi-Lo card values, glows, strategy hints, and the autoplay counting drill.',
};

export function countCoachCapabilities(level: CountCoachLevel): CountCoachCapabilities {
  const full = level === 'full';
  return {
    level,
    showLiveCounts: full,
    showCardValueGlow: full,
    useTrainingSkin: full,
    showCountCheck: level === 'learn',
    allowFullTools: full,
    showShoeProgress: true,
  };
}

export function isCountCoachLevel(value: unknown): value is CountCoachLevel {
  return value === 'off' || value === 'learn' || value === 'full';
}

// ---------------------------------------------------------------------------
// Learn mode — post-round count checks
// ---------------------------------------------------------------------------

export type CountCheckKind = 'running' | 'true';

/**
 * Adaptive cadence: struggling players get checked every round; a hot streak
 * earns breathing room (every 2nd round after 3 straight, every 3rd after 6).
 * One miss snaps back to every round.
 */
export function checkIntervalForStreak(streak: number): number {
  if (streak >= 6) {
    return 3;
  }
  if (streak >= 3) {
    return 2;
  }
  return 1;
}

export function isCountCheckDue(roundsSinceCheck: number, streak: number): boolean {
  return roundsSinceCheck >= checkIntervalForStreak(streak);
}

/**
 * Once the running count is solid (streak ≥ 4), every other check graduates
 * to the true count — the number that actually drives betting decisions.
 */
export function countCheckKind(streak: number, checksAsked: number): CountCheckKind {
  return streak >= 4 && checksAsked % 2 === 1 ? 'true' : 'running';
}

/**
 * 4 unique choices including the answer, shuffled. Offsets hug the correct
 * value so wrong options stay plausible. `step` is 1 for running counts and
 * 0.5 for true counts (which are rounded to the nearest half).
 */
export function buildCountChoices(
  correct: number,
  random: () => number = Math.random,
  step = 1,
): number[] {
  const options = new Set<number>([correct]);
  const candidateOffsets = [-3, -2, -1, 1, 2, 3, 4, -4].map((offset) => offset * step);
  while (options.size < 4 && candidateOffsets.length > 0) {
    const index = Math.floor(random() * candidateOffsets.length);
    const [offset] = candidateOffsets.splice(index, 1);
    options.add(correct + offset);
  }
  const list = [...options];
  // Fisher–Yates shuffle so the correct answer's position is random.
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** +3 / 0 / −1.5 — counts always render with an explicit sign. */
export function formatCount(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
