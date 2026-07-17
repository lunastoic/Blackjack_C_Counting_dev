/**
 * Cross-cutting domain types shared by later milestones (persistence, stores,
 * settings UI). Kept in the engine so the whole domain model is pure TS.
 */
import { GameMode } from './blackjack/rules';
import { DeckCount } from './shoe/shoe';
import { LifetimeStats } from './achievements/stats';

/** Tools active while the Count Coach is Full (the old Training Mode kit). */
export interface TrainingAidSettings {
  /** Green/gray/red per-card glow (default on). */
  readonly cardUnderglow: boolean;
  /** Yellow glow on the recommended action button (default on). */
  readonly strategyHints: boolean;
  /** Full-screen color flash per dealt card (default off). */
  readonly countPulse: boolean;
  /** Dealt-vs-remaining rank bar charts (default off). */
  readonly distributionCharts: boolean;
}

/**
 * Count Coach — how much counting help the player gets at the table.
 * Off = pure casino play. Learn = play normally, get quizzed on the count.
 * Full = every live aid the old Training Mode had.
 */
export const COUNT_COACH_LEVELS = ['off', 'learn', 'full'] as const;
export type CountCoachLevel = (typeof COUNT_COACH_LEVELS)[number];

export interface GameSettings {
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  /** Multiplier applied to all deal/flip/dealer timings: 0.5–2.0 (default 1.0). */
  readonly dealerSpeed: number;
  /** Decks per mode, user-selectable in in-game settings (default 6). */
  readonly deckCounts: Readonly<Record<GameMode, DeckCount>>;
  readonly trainingAids: TrainingAidSettings;
  /** Counting assistance at the table (default full = every aid on). */
  readonly countCoachLevel: CountCoachLevel;
  /** Collapses gameplay animation for accessibility. */
  readonly reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  dealerSpeed: 1.0,
  deckCounts: { regular: 6, quiz: 6 },
  trainingAids: {
    cardUnderglow: true,
    strategyHints: true,
    countPulse: false,
    distributionCharts: false,
  },
  countCoachLevel: 'full',
  reducedMotion: false,
};

export interface EconomySave {
  readonly chips: number;
  readonly lastBet: number;
  /** Epoch ms of the last daily-reward claim, null if never claimed. */
  readonly dailyRewardClaimedAt: number | null;
  /** Epoch ms of the last simulated-ad reward claim, null if never claimed. */
  readonly adRewardClaimedAt: number | null;
}

export interface ProgressionSave {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly unlockedMapIds: readonly number[];
}

export interface AchievementsSave {
  readonly stats: LifetimeStats;
  readonly unlockedIds: readonly string[];
}

/**
 * Versioned save envelope. Milestone 2 wires this to AsyncStorage with Zod
 * validation and a migration ladder keyed on schemaVersion.
 */
export interface PersistedSaveData {
  readonly schemaVersion: number;
  readonly economy: EconomySave;
  readonly progression: ProgressionSave;
  readonly settings: GameSettings;
  readonly achievements: AchievementsSave;
}

export const SAVE_SCHEMA_VERSION = 1;
