import { create } from 'zustand';
import { GameMode } from '../engine/blackjack/rules';
import { DECK_COUNTS, DeckCount } from '../engine/shoe/shoe';
import { DEFAULT_SETTINGS, TrainingAidSettings } from '../engine/types';
import { SaveData } from '../persistence/schema';

export const DEALER_SPEED_MIN = 0.5;
export const DEALER_SPEED_MAX = 2.0;
export const DEALER_SPEED_STEP = 0.25;

interface SettingsState {
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly dealerSpeed: number;
  readonly deckCounts: Readonly<Record<GameMode, DeckCount>>;
  readonly trainingAids: TrainingAidSettings;
  /** App-level reduced-motion override (combined with the OS preference). */
  readonly reducedMotion: boolean;
  setSoundEnabled(enabled: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  /** Clamped to 0.5×–2.0×. */
  setDealerSpeed(speed: number): void;
  /** Ignored unless the count is one of 1/2/4/6/8. */
  setDeckCount(mode: GameMode, count: number): void;
  setTrainingAid(aid: keyof TrainingAidSettings, enabled: boolean): void;
  setReducedMotion(enabled: boolean): void;
  hydrate(data: SaveData['settings']): void;
}

export function clampDealerSpeed(speed: number): number {
  if (Number.isNaN(speed)) {
    return DEFAULT_SETTINGS.dealerSpeed;
  }
  return Math.min(DEALER_SPEED_MAX, Math.max(DEALER_SPEED_MIN, speed));
}

export function isValidDeckCount(count: number): count is DeckCount {
  return (DECK_COUNTS as readonly number[]).includes(count);
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  soundEnabled: DEFAULT_SETTINGS.soundEnabled,
  hapticsEnabled: DEFAULT_SETTINGS.hapticsEnabled,
  dealerSpeed: DEFAULT_SETTINGS.dealerSpeed,
  deckCounts: { ...DEFAULT_SETTINGS.deckCounts },
  trainingAids: { ...DEFAULT_SETTINGS.trainingAids },
  reducedMotion: DEFAULT_SETTINGS.reducedMotion,

  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  setDealerSpeed: (speed) => set({ dealerSpeed: clampDealerSpeed(speed) }),
  setDeckCount: (mode, count) =>
    set((state) =>
      isValidDeckCount(count) ? { deckCounts: { ...state.deckCounts, [mode]: count } } : state,
    ),
  setTrainingAid: (aid, enabled) =>
    set((state) => ({ trainingAids: { ...state.trainingAids, [aid]: enabled } })),
  setReducedMotion: (enabled) => set({ reducedMotion: enabled }),

  hydrate: (data) =>
    set({
      soundEnabled: data.soundEnabled,
      hapticsEnabled: data.hapticsEnabled,
      dealerSpeed: clampDealerSpeed(data.dealerSpeed),
      deckCounts: { ...data.deckCounts },
      trainingAids: { ...data.trainingAids },
      reducedMotion: data.reducedMotion,
    }),
}));
