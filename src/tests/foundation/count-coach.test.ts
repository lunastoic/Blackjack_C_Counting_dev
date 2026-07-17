import { createDefaultSave } from '../../persistence/defaults';
import { runMigrations } from '../../persistence/migrations';
import { SAVE_SCHEMA_VERSION, settingsSchema } from '../../persistence/schema';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  buildCountChoices,
  checkIntervalForStreak,
  countCheckKind,
  countCoachCapabilities,
  formatCount,
  isCountCheckDue,
  isCountCoachLevel,
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

  it('Full turns on live counts, glows, the training skin, and the tools', () => {
    const caps = countCoachCapabilities('full');
    expect(caps.showLiveCounts).toBe(true);
    expect(caps.showCardValueGlow).toBe(true);
    expect(caps.useTrainingSkin).toBe(true);
    expect(caps.allowFullTools).toBe(true);
    expect(caps.showCountCheck).toBe(false);
  });

  it('isCountCoachLevel guards invalid and legacy values', () => {
    expect(isCountCoachLevel('full')).toBe(true);
    expect(isCountCoachLevel('learn')).toBe(true);
    expect(isCountCoachLevel('guided')).toBe(false);
    expect(isCountCoachLevel('light')).toBe(false);
    expect(isCountCoachLevel('quiz')).toBe(false);
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

    for (const [from, to] of [
      ['off', 'off'],
      ['light', 'learn'],
      ['guided', 'learn'],
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
    expect(SAVE_SCHEMA_VERSION).toBe(5);
  });
});
