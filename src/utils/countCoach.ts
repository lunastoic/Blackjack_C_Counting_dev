import { FEATURES } from '../constants/features';
import { CountCoachLevel, TrainingAidSettings } from '../engine/types';
import { formatChips } from './format';

/**
 * Count Coach — the single dial for counting help at the table.
 *
 * Off   → pure casino play, no aids.
 * Full  → the coach in one piece. The count meter and rail run live — the
 *         running count of every card shown, the true count beside it — and
 *         around them the old Training Mode kit: Hi-Lo card underglow,
 *         strategy hints, card charts, and the bet tip beside the rail (see
 *         the bet advice below). The post-round count checks still run
 *         behind their flag.
 * Learn → the meter fogged ("?") until the player proves the count with a
 *         check — one answer lights the running count, a second the true
 *         count, a miss fogs a tier back — without the Full kit. Off the
 *         dial since schema v16; the level stays wired so the flag-less
 *         Training switch (and any old code path) can still run it.
 */
export interface CountCoachCapabilities {
  readonly level: CountCoachLevel;
  /** The count strip's running / true count and the vertical count rail (Full). */
  readonly showLiveCounts: boolean;
  /** Hi-Lo underglow on dealt cards (Full, with the underglow toggle). */
  readonly showCardValueGlow: boolean;
  /** Card faces printed with their Hi-Lo values (Full). */
  readonly useTrainingSkin: boolean;
  /** Multiple-choice count checks: tap-to-prove (Learn), and post-round behind its flag (Learn, Full). */
  readonly showCountCheck: boolean;
  /** Fogged count meter: "?" until a check is answered correctly (Learn). */
  readonly showMaskedCounts: boolean;
  /** Strategy chart/hints, distribution charts, count pulse, autoplay drill (Full). */
  readonly allowFullTools: boolean;
  /** Cut-card marker + shoe progress on the piles (all levels). */
  readonly showShoeProgress: boolean;
}

export const COUNT_COACH_LABELS: Record<CountCoachLevel, string> = {
  off: 'Off',
  learn: 'Learn',
  full: 'On',
};

export const COUNT_COACH_BLURBS: Record<CountCoachLevel, string> = {
  off: 'Pure casino play — counts stay hidden. Just you and the shoe.',
  learn: 'The count meter rides along fogged ("?"). Tap it or pass the post-round checks to reveal the numbers — a miss fogs them again, a shuffle resets everything.',
  full: 'The coach rides along: the live count meter and rail, Hi-Lo card glows, strategy hints, the card charts, and bet tips off the count.',
};

/** The one-and-only cycle order of the felt's coach tab: Off → Full → Off. */
export const COUNT_COACH_ORDER: readonly CountCoachLevel[] = ['off', 'full'];

/** A level off the dial (legacy Learn) steps onto it at Full. */
export function nextCountCoachLevel(level: CountCoachLevel): CountCoachLevel {
  const index = COUNT_COACH_ORDER.indexOf(level);
  return index < 0 ? 'full' : COUNT_COACH_ORDER[(index + 1) % COUNT_COACH_ORDER.length];
}

export function countCoachCapabilities(level: CountCoachLevel): CountCoachCapabilities {
  const full = level === 'full';
  const learn = level === 'learn';
  return {
    level,
    showLiveCounts: full,
    showCardValueGlow: full,
    useTrainingSkin: full,
    showCountCheck: full || learn,
    showMaskedCounts: learn,
    allowFullTools: full,
    showShoeProgress: true,
  };
}

export function isCountCoachLevel(value: unknown): value is CountCoachLevel {
  return value === 'off' || value === 'learn' || value === 'full';
}

/**
 * The level the table actually runs. With the coach dial enabled
 * (FEATURES.countCoachDial) that is the stored dial setting, full stop. With
 * it disabled the dial is ignored and the table-side Training Mode switch
 * picks between Full (on: live counts, rail, glows, hints) and Learn (off:
 * the fogged meter with tap-to-reveal).
 */
export function effectiveCountCoachLevel(
  selected: CountCoachLevel,
  trainingMode = true,
): CountCoachLevel {
  if (FEATURES.countCoachDial) {
    return selected;
  }
  return trainingMode ? 'full' : 'learn';
}

/**
 * The Full-coach aids that are actually on. The per-aid switches are shelved
 * (FEATURES.trainingAidToggles), so Full means the underglow, strategy hints
 * and card charts together and the count pulse dark — the stored switches
 * only count once their UI returns.
 */
export const FULL_COACH_AIDS: TrainingAidSettings = {
  cardUnderglow: true,
  strategyHints: true,
  countPulse: false,
  distributionCharts: true,
};

export function effectiveTrainingAids(aids: TrainingAidSettings): TrainingAidSettings {
  return FEATURES.trainingAidToggles ? aids : FULL_COACH_AIDS;
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

// ---------------------------------------------------------------------------
// Full coach — the bet tip beside the count rail
// ---------------------------------------------------------------------------

export type BetAdviceTone = 'cold' | 'flat' | 'hot';

export interface BetAdvice {
  readonly tone: BetAdviceTone;
  /** "Count is −6" — the number on the rail the tip points at. */
  readonly headline: string;
  readonly detail: string;
}

/** True count at or below this and the shoe is against you. */
export const COLD_TRUE_COUNT = -1;
/** True count at or above this and the shoe is yours. */
export const HOT_TRUE_COUNT = 2;
/** A flat shoe draws a nudge only once this many units are out. */
const FLAT_NUDGE_UNITS = 3;

/**
 * One betting unit: 1% of the bankroll, in whole chips of the tray's
 * smallest denomination and never less than one of them.
 */
export function betUnit(bankroll: number, smallestChip: number): number {
  const chip = Math.max(1, smallestChip);
  return Math.max(chip, Math.floor(bankroll / 100 / chip) * chip);
}

/** Units to have out on a hot shoe — the classic "true count minus one". */
export function betUnitsForTrueCount(trueCount: number): number {
  return Math.max(1, Math.round(trueCount) - 1);
}

export interface BetAdviceInput {
  readonly runningCount: number;
  readonly trueCount: number;
  /** Chips staged in the bet circle. */
  readonly wager: number;
  /** Chips in hand plus the staged wager. */
  readonly bankroll: number;
  readonly smallestChip: number;
  readonly maxBet: number;
  /**
   * The true count is proven, so the tip may quote a size. Fogged, it says
   * hot or cold and no more — the number is the player's to work out.
   */
  readonly showSize: boolean;
}

/**
 * What the coach says about the bet on the table, keyed to the true count
 * (the number that sizes bets) but headed by the running count the rail
 * shows. Cold: bet the minimum, and say so louder when more is out. Hot:
 * press the bet, to a size once the true count is proven. Flat: nothing,
 * unless the player is ramping without an edge. Null means stay quiet.
 */
export function betAdviceForCount(input: BetAdviceInput): BetAdvice | null {
  const { runningCount, trueCount, wager, bankroll, smallestChip, maxBet, showSize } = input;
  const unit = betUnit(bankroll, smallestChip);
  const headline = `Count is ${formatCount(runningCount)}`;

  if (trueCount <= COLD_TRUE_COUNT) {
    return {
      tone: 'cold',
      headline,
      detail:
        wager > unit
          ? "Cold shoe — that's too much out there. Bet the minimum."
          : 'Cold shoe — keep it at the minimum.',
    };
  }

  if (trueCount >= HOT_TRUE_COUNT) {
    if (!showSize) {
      return {
        tone: 'hot',
        headline,
        detail: wager > unit ? 'Hot shoe — good, keep pressing.' : 'Hot shoe — press your bet.',
      };
    }
    const units = betUnitsForTrueCount(trueCount);
    const target = Math.min(maxBet, units * unit);
    return {
      tone: 'hot',
      headline,
      detail:
        wager >= target
          ? `Hot shoe — ${units} unit${units === 1 ? '' : 's'} out, that's the bet.`
          : `Hot shoe — press to ${units} unit${units === 1 ? '' : 's'} (${formatChips(target)} chips).`,
    };
  }

  if (wager >= FLAT_NUDGE_UNITS * unit) {
    return { tone: 'flat', headline, detail: 'No edge yet — keep the bet flat.' };
  }
  return null;
}
