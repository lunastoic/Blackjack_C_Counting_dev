import { createDefaultSave } from '../../persistence/defaults';
import { runMigrations } from '../../persistence/migrations';
import { SAVE_SCHEMA_VERSION, settingsSchema } from '../../persistence/schema';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  betAdviceForCount,
  betUnit,
  betUnitsForTrueCount,
  buildCountChoices,
  checkIntervalForStreak,
  COUNT_COACH_ORDER,
  countCheckKind,
  countCoachCapabilities,
  effectiveCountCoachLevel,
  formatCount,
  isCountCheckDue,
  isCountCoachLevel,
  nextCountCoachLevel,
} from '../../utils/countCoach';

describe('Count Coach levels', () => {
  beforeEach(() => {
    useSettingsStore.getState().hydrate(createDefaultSave().settings);
  });

  it('defaults to Full (the merged Training Mode experience)', () => {
    expect(useSettingsStore.getState().countCoachLevel).toBe('full');
  });

  it.each(['off', 'learn', 'full'] as const)('accepts level %s', (level) => {
    useSettingsStore.getState().setCountCoachLevel(level);
    expect(useSettingsStore.getState().countCoachLevel).toBe(level);
  });

  it('Off hides every aid except shoe progress', () => {
    const caps = countCoachCapabilities('off');
    expect(caps.showLiveCounts).toBe(false);
    expect(caps.showCardValueGlow).toBe(false);
    expect(caps.useTrainingSkin).toBe(false);
    expect(caps.showCountCheck).toBe(false);
    expect(caps.allowFullTools).toBe(false);
    expect(caps.showShoeProgress).toBe(true);
  });

  it('Learn plays clean but enables the count checks', () => {
    const caps = countCoachCapabilities('learn');
    expect(caps.showCountCheck).toBe(true);
    expect(caps.showLiveCounts).toBe(false);
    expect(caps.showCardValueGlow).toBe(false);
    expect(caps.allowFullTools).toBe(false);
  });

  it('Full turns on the rail, glows, the training skin, the tools — and carries the fogged meter with its checks', () => {
    const caps = countCoachCapabilities('full');
    expect(caps.showLiveCounts).toBe(true);
    expect(caps.showCardValueGlow).toBe(true);
    expect(caps.useTrainingSkin).toBe(true);
    expect(caps.allowFullTools).toBe(true);
    expect(caps.showCountCheck).toBe(true);
    expect(caps.showMaskedCounts).toBe(true);
  });

  it('the dial flips Off ↔ Full; legacy Learn steps onto it at Full', () => {
    expect(COUNT_COACH_ORDER).toEqual(['off', 'full']);
    expect(nextCountCoachLevel('off')).toBe('full');
    expect(nextCountCoachLevel('full')).toBe('off');
    expect(nextCountCoachLevel('learn')).toBe('full');
  });

  it('isCountCoachLevel guards invalid and legacy values', () => {
    expect(isCountCoachLevel('full')).toBe(true);
    expect(isCountCoachLevel('learn')).toBe(true);
    expect(isCountCoachLevel('guided')).toBe(false);
    expect(isCountCoachLevel('light')).toBe(false);
    expect(isCountCoachLevel('quiz')).toBe(false);
  });

  it('the dial alone picks the effective level; the legacy Training switch is ignored', () => {
    expect(useSettingsStore.getState().trainingMode).toBe(true);
    for (const level of ['off', 'learn', 'full'] as const) {
      expect(effectiveCountCoachLevel(level, true)).toBe(level);
      expect(effectiveCountCoachLevel(level, false)).toBe(level);
    }
    useSettingsStore.getState().setTrainingMode(false);
    expect(useSettingsStore.getState().trainingMode).toBe(false);
  });
});

describe('Learn coach count checks', () => {
  it('checks every round until 3 straight, then every 2nd, then every 3rd', () => {
    expect(checkIntervalForStreak(0)).toBe(1);
    expect(checkIntervalForStreak(2)).toBe(1);
    expect(checkIntervalForStreak(3)).toBe(2);
    expect(checkIntervalForStreak(5)).toBe(2);
    expect(checkIntervalForStreak(6)).toBe(3);
    expect(checkIntervalForStreak(20)).toBe(3);
  });

  it('isCountCheckDue matches the cadence', () => {
    expect(isCountCheckDue(1, 0)).toBe(true);
    expect(isCountCheckDue(1, 3)).toBe(false);
    expect(isCountCheckDue(2, 3)).toBe(true);
    expect(isCountCheckDue(2, 6)).toBe(false);
    expect(isCountCheckDue(3, 6)).toBe(true);
  });

  it('graduates to true-count questions at streak 4+', () => {
    expect(countCheckKind(0, 0)).toBe('running');
    expect(countCheckKind(3, 1)).toBe('running');
    expect(countCheckKind(4, 0)).toBe('running');
    expect(countCheckKind(4, 1)).toBe('true');
    expect(countCheckKind(7, 3)).toBe('true');
  });

  it('builds 4 unique choices containing the answer', () => {
    for (let answer = -8; answer <= 8; answer++) {
      const choices = buildCountChoices(answer);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(answer);
    }
  });

  it('builds half-step choices for true counts', () => {
    const choices = buildCountChoices(1.5, Math.random, 0.5);
    expect(choices).toHaveLength(4);
    expect(choices).toContain(1.5);
    for (const choice of choices) {
      expect(Math.abs(choice * 2 - Math.round(choice * 2))).toBeLessThan(1e-9);
    }
  });

  it('formats counts with explicit signs', () => {
    expect(formatCount(3)).toBe('+3');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(-2.5)).toBe('-2.5');
  });
});

describe('save migration', () => {
  it('migrates v4 saves to v5: coach collapses to off/learn/full', () => {
    const base = createDefaultSave() as unknown as Record<string, unknown>;
    const makeV4 = (countCoachLevel: string) => ({
      ...base,
      settings: {
        ...(base.settings as object),
        countCoachLevel,
        deckCounts: { training: 2, regular: 4, quiz: 8 },
      },
      modeStats: {
        regular: (base.modeStats as { regular: object }).regular,
        quiz: (base.modeStats as { quiz: object }).quiz,
      },
    });

    // v5 lands light/guided on Learn; the ladder then carries Learn into Full (v16).
    for (const [from, to] of [
      ['off', 'off'],
      ['light', 'full'],
      ['guided', 'full'],
      ['full', 'full'],
    ] as const) {
      const migrated = runMigrations(makeV4(from), 4) as {
        settings: Record<string, unknown>;
        modeStats: Record<string, unknown>;
      };
      expect(migrated.settings.countCoachLevel).toBe(to);
      expect(migrated.settings.deckCounts).toEqual({ regular: 4, quiz: 8 });
      expect(migrated.modeStats.learn).toEqual({
        checksAsked: 0,
        checksCorrect: 0,
        bestStreak: 0,
      });
      expect(settingsSchema.parse(migrated.settings).countCoachLevel).toBe(to);
    }
    expect(SAVE_SCHEMA_VERSION).toBe(17);
  });
});

describe('Full coach bet tip', () => {
  const base = {
    runningCount: 0,
    trueCount: 0,
    wager: 0,
    bankroll: 500,
    smallestChip: 1,
    maxBet: 1_000,
    showSize: true,
  };

  it('sizes a unit at 1% of the bankroll in whole smallest chips, one chip at least', () => {
    expect(betUnit(500, 1)).toBe(5);
    expect(betUnit(500, 5)).toBe(5);
    expect(betUnit(500, 25)).toBe(25);
    expect(betUnit(10_000, 25)).toBe(100);
    expect(betUnit(40, 1)).toBe(1);
  });

  it('presses true count minus one units, one at the least', () => {
    expect(betUnitsForTrueCount(2)).toBe(1);
    expect(betUnitsForTrueCount(3.5)).toBe(3);
    expect(betUnitsForTrueCount(6)).toBe(5);
    expect(betUnitsForTrueCount(-4)).toBe(1);
  });

  it('stays quiet on a flat shoe unless the player is ramping', () => {
    expect(betAdviceForCount(base)).toBeNull();
    expect(betAdviceForCount({ ...base, trueCount: 1, wager: 10 })).toBeNull();
    expect(betAdviceForCount({ ...base, wager: 15 })).toEqual({
      tone: 'flat',
      headline: 'Count is 0',
      detail: 'No edge yet — keep the bet flat.',
    });
  });

  it('calls a cold shoe by the running count and gets louder with more out', () => {
    const quiet = betAdviceForCount({ ...base, runningCount: -6, trueCount: -6, wager: 5 });
    expect(quiet).toEqual({
      tone: 'cold',
      headline: 'Count is -6',
      detail: 'Cold shoe — keep it at the minimum.',
    });
    const loud = betAdviceForCount({ ...base, runningCount: -6, trueCount: -6, wager: 100 });
    expect(loud?.tone).toBe('cold');
    expect(loud?.detail).toBe("Cold shoe — that's too much out there. Bet the minimum.");
    expect(betAdviceForCount({ ...base, runningCount: -1, trueCount: -1 })?.tone).toBe('cold');
    expect(betAdviceForCount({ ...base, runningCount: -1, trueCount: -0.5 })).toBeNull();
  });

  it('calls a hot shoe with a size once the true count is proven', () => {
    expect(betAdviceForCount({ ...base, runningCount: 4, trueCount: 4 })).toEqual({
      tone: 'hot',
      headline: 'Count is +4',
      detail: 'Hot shoe — press to 3 units (15 chips).',
    });
    expect(betAdviceForCount({ ...base, runningCount: 4, trueCount: 4, wager: 15 })?.detail).toBe(
      "Hot shoe — 3 units out, that's the bet.",
    );
    // A proven size never asks for more than the table takes.
    expect(
      betAdviceForCount({ ...base, runningCount: 9, trueCount: 9, bankroll: 200_000, maxBet: 1_000 })
        ?.detail,
    ).toBe('Hot shoe — press to 8 units (1,000 chips).');
  });

  it('holds the size back while the true count is still fogged', () => {
    expect(
      betAdviceForCount({ ...base, runningCount: 4, trueCount: 4, showSize: false })?.detail,
    ).toBe('Hot shoe — press your bet.');
    expect(
      betAdviceForCount({ ...base, runningCount: 4, trueCount: 4, wager: 20, showSize: false })
        ?.detail,
    ).toBe('Hot shoe — good, keep pressing.');
  });
});
