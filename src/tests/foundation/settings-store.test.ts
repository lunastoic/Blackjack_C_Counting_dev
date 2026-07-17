import { createDefaultSave } from '../../persistence/defaults';
import {
  clampDealerSpeed,
  DEALER_SPEED_MAX,
  DEALER_SPEED_MIN,
  isValidDeckCount,
  useSettingsStore,
} from '../../stores/settingsStore';

function resetSettings(): void {
  useSettingsStore.getState().hydrate(createDefaultSave().settings);
}

describe('settings store', () => {
  beforeEach(resetSettings);

  describe('dealer speed', () => {
    it('accepts values inside 0.5–2.0', () => {
      useSettingsStore.getState().setDealerSpeed(1.5);
      expect(useSettingsStore.getState().dealerSpeed).toBe(1.5);
    });

    it('clamps values below the minimum', () => {
      useSettingsStore.getState().setDealerSpeed(0.1);
      expect(useSettingsStore.getState().dealerSpeed).toBe(DEALER_SPEED_MIN);
    });

    it('clamps values above the maximum', () => {
      useSettingsStore.getState().setDealerSpeed(5);
      expect(useSettingsStore.getState().dealerSpeed).toBe(DEALER_SPEED_MAX);
    });

    it('clampDealerSpeed recovers from non-finite input', () => {
      expect(clampDealerSpeed(Number.NaN)).toBe(1.0);
      expect(clampDealerSpeed(Number.POSITIVE_INFINITY)).toBe(DEALER_SPEED_MAX);
    });
  });

  describe('deck counts', () => {
    it.each([1, 2, 4, 6, 8])('allows %i decks', (count) => {
      expect(isValidDeckCount(count)).toBe(true);
      useSettingsStore.getState().setDeckCount('training', count);
      expect(useSettingsStore.getState().deckCounts.training).toBe(count);
    });

    it.each([0, 3, 5, 7, 9, -1, 2.5])('rejects %d decks', (count) => {
      expect(isValidDeckCount(count)).toBe(false);
      useSettingsStore.getState().setDeckCount('regular', count);
      expect(useSettingsStore.getState().deckCounts.regular).toBe(6);
    });

    it('tracks training and regular counts independently', () => {
      useSettingsStore.getState().setDeckCount('training', 1);
      useSettingsStore.getState().setDeckCount('regular', 8);
      expect(useSettingsStore.getState().deckCounts.training).toBe(1);
      expect(useSettingsStore.getState().deckCounts.regular).toBe(8);
      expect(useSettingsStore.getState().deckCounts.quiz).toBe(6);
    });
  });

  it('toggles sound, haptics, and reduced motion', () => {
    useSettingsStore.getState().setSoundEnabled(false);
    useSettingsStore.getState().setHapticsEnabled(false);
    useSettingsStore.getState().setReducedMotion(true);
    const state = useSettingsStore.getState();
    expect(state.soundEnabled).toBe(false);
    expect(state.hapticsEnabled).toBe(false);
    expect(state.reducedMotion).toBe(true);
  });

  it('toggles individual training aids without touching the others', () => {
    useSettingsStore.getState().setTrainingAid('countPulse', true);
    const aids = useSettingsStore.getState().trainingAids;
    expect(aids.countPulse).toBe(true);
    expect(aids.cardUnderglow).toBe(true);
    expect(aids.strategyHints).toBe(true);
    expect(aids.distributionCharts).toBe(false);
  });

  it('hydration clamps out-of-range persisted dealer speed', () => {
    useSettingsStore.getState().hydrate({
      ...createDefaultSave().settings,
      dealerSpeed: 0.75,
    });
    expect(useSettingsStore.getState().dealerSpeed).toBe(0.75);
  });
});
