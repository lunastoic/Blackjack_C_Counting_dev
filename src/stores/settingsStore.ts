import { create } from 'zustand';
import { GameMode } from '../engine/blackjack/rules';
import { DECK_COUNTS, DeckCount } from '../engine/shoe/shoe';
import {
  CardDeck,
  CountCoachLevel,
  DEFAULT_SETTINGS,
  isCardDeck,
  isUiStyle,
  TrainingAidSettings,
  UiStyle,
} from '../engine/types';
import { SaveData } from '../persistence/schema';
import { isCountCoachLevel } from '../utils/countCoach';

export const DEALER_SPEED_MIN = 0.5;
export const DEALER_SPEED_MAX = 2.0;
export const DEALER_SPEED_STEP = 0.25;

interface SettingsState {
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  /** Plain deck art dealt wherever a card is not coach-annotated. */
  readonly cardDeck: CardDeck;
  /** Modern (arcade, drawn in code) or Classic (original assets) intros and buttons. */
  readonly uiStyle: UiStyle;
  readonly dealerSpeed: number;
  readonly deckCounts: Readonly<Record<GameMode, DeckCount>>;
  readonly trainingAids: TrainingAidSettings;
  readonly countCoachLevel: CountCoachLevel;
  /** Table-side Training Mode switch: live counts, rail, underglow, hints. */
  readonly trainingMode: boolean;
  /** App-level reduced-motion override (combined with the OS preference). */
  readonly reducedMotion: boolean;
  setSoundEnabled(enabled: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  /** Ignored unless the deck is a known skin. */
  setCardDeck(deck: CardDeck): void;
  /** Ignored unless the style is a known look. */
  setUiStyle(style: UiStyle): void;
  /** Clamped to 0.5×–2.0×. */
  setDealerSpeed(speed: number): void;
  /** Ignored unless the count is one of 1/2/4/6/8. */
  setDeckCount(mode: GameMode, count: number): void;
  setTrainingAid(aid: keyof TrainingAidSettings, enabled: boolean): void;
  setCountCoachLevel(level: CountCoachLevel): void;
  setTrainingMode(enabled: boolean): void;
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
  cardDeck: DEFAULT_SETTINGS.cardDeck,
  uiStyle: DEFAULT_SETTINGS.uiStyle,
  dealerSpeed: DEFAULT_SETTINGS.dealerSpeed,
  deckCounts: { ...DEFAULT_SETTINGS.deckCounts },
  trainingAids: { ...DEFAULT_SETTINGS.trainingAids },
  countCoachLevel: DEFAULT_SETTINGS.countCoachLevel,
  trainingMode: DEFAULT_SETTINGS.trainingMode,
  reducedMotion: DEFAULT_SETTINGS.reducedMotion,

  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  setCardDeck: (deck) => set((state) => (isCardDeck(deck) ? { cardDeck: deck } : state)),
  setUiStyle: (style) => set((state) => (isUiStyle(style) ? { uiStyle: style } : state)),
  setDealerSpeed: (speed) => set({ dealerSpeed: clampDealerSpeed(speed) }),
  setDeckCount: (mode, count) =>
    set((state) =>
      isValidDeckCount(count) ? { deckCounts: { ...state.deckCounts, [mode]: count } } : state,
    ),
  setTrainingAid: (aid, enabled) =>
    set((state) => ({ trainingAids: { ...state.trainingAids, [aid]: enabled } })),
  setCountCoachLevel: (level) =>
    set((state) => (isCountCoachLevel(level) ? { countCoachLevel: level } : state)),
  setTrainingMode: (enabled) => set({ trainingMode: enabled }),
  setReducedMotion: (enabled) => set({ reducedMotion: enabled }),

  hydrate: (data) =>
    set({
      soundEnabled: data.soundEnabled,
      hapticsEnabled: data.hapticsEnabled,
      cardDeck: isCardDeck(data.cardDeck) ? data.cardDeck : DEFAULT_SETTINGS.cardDeck,
      uiStyle: isUiStyle(data.uiStyle) ? data.uiStyle : DEFAULT_SETTINGS.uiStyle,
      dealerSpeed: clampDealerSpeed(data.dealerSpeed),
      deckCounts: { ...data.deckCounts },
      trainingAids: { ...data.trainingAids },
      countCoachLevel: isCountCoachLevel(data.countCoachLevel)
        ? data.countCoachLevel
        : DEFAULT_SETTINGS.countCoachLevel,
      trainingMode: data.trainingMode,
      reducedMotion: data.reducedMotion,
    }),
}));
