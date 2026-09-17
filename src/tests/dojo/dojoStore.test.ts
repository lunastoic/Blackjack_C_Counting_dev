import { createDefaultSave } from '../../persistence/defaults';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { __resetPersistenceForTests } from '../../persistence/hydrate';

function resetDojo(): void {
  useDojoStore.getState().hydrate(createDefaultSave().dojo);
}

describe('dojo store', () => {
  beforeEach(() => {
    __resetPersistenceForTests();
    resetDojo();
  });

  it('starts with no completed lessons', () => {
    expect(useDojoStore.getState().completedLessons.size).toBe(0);
    expect(useDojoStore.getState().onboardingDone).toBe(false);
  });

  it('completes a lesson and awards XP', () => {
    useDojoStore.getState().completeLesson('hi-lo-values');
    expect(useDojoStore.getState().completedLessons.has('hi-lo-values')).toBe(true);
    expect(useDojoStore.getState().totalDojoXp).toBeGreaterThan(0);
  });

  it('pays the level-up chip reward when training XP crosses a level', () => {
    const defaults = createDefaultSave();
    useEconomyStore.getState().hydrate({ ...defaults.economy, chips: 500 });
    useProgressionStore.getState().hydrate({ ...defaults.progression, level: 1, xpIntoLevel: 29 });
    const outcome = useDojoStore.getState().completeLesson('hi-lo-values');
    expect(outcome.progression.levelsGained).toBe(1);
    expect(useEconomyStore.getState().chips).toBe(500 + outcome.progression.chipReward);
    expect(outcome.progression.chipReward).toBeGreaterThan(0);
  });

  it('records a drill result', () => {
    useDojoStore.getState().recordDrillResult('values', {
      correct: 18,
      totalAnswered: 20,
      accuracy: 0.9,
      xp: 7,
    });
    expect(useDojoStore.getState().drillBests.values?.accuracy).toBe(0.9);
  });

  it('toggles onboarding', () => {
    useDojoStore.getState().finishOnboarding();
    expect(useDojoStore.getState().onboardingDone).toBe(true);
    useDojoStore.getState().startOnboarding();
    expect(useDojoStore.getState().onboardingDone).toBe(false);
  });
});
