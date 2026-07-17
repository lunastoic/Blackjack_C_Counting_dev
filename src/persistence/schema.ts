import { z } from 'zod';

/**
 * Zod schemas for the persisted save. Parsed JSON is NEVER trusted without
 * passing these. Shapes intentionally mirror the engine domain types
 * (GameSettings, LifetimeStats, PlayerProgress) rather than duplicating logic.
 */

export const SAVE_SCHEMA_VERSION = 5;

export const MAX_DISPLAY_NAME_LENGTH = 20;
export const DEFAULT_DISPLAY_NAME = 'Player';

const deckCountSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(4),
  z.literal(6),
  z.literal(8),
]);

const chipAmount = z.number().int().min(0);

export const profileSchema = z.object({
  displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH),
  createdAt: z.number().int().nullable(),
});

export const economySchema = z.object({
  chips: chipAmount,
  lastBet: chipAmount,
  dailyRewardClaimedAt: z.number().int().nullable(),
  adRewardClaimedAt: z.number().int().nullable(),
});

export const progressionSchema = z.object({
  level: z.number().int().min(1).max(25),
  xpIntoLevel: z.number().int().min(0).max(29),
  unlockedMapIds: z.array(z.number().int().min(1).max(6)).min(1),
});

const countCoachLevelSchema = z.union([
  z.literal('off'),
  z.literal('learn'),
  z.literal('full'),
]);

export const settingsSchema = z.object({
  soundEnabled: z.boolean(),
  hapticsEnabled: z.boolean(),
  dealerSpeed: z.number().min(0.5).max(2),
  deckCounts: z.object({
    regular: deckCountSchema,
    quiz: deckCountSchema,
  }),
  trainingAids: z.object({
    cardUnderglow: z.boolean(),
    strategyHints: z.boolean(),
    countPulse: z.boolean(),
    distributionCharts: z.boolean(),
  }),
  countCoachLevel: countCoachLevelSchema,
  reducedMotion: z.boolean(),
});

const statCount = z.number().int().min(0);

export const lifetimeStatsSchema = z.object({
  handsPlayed: statCount,
  wins: statCount,
  pushes: statCount,
  losses: statCount,
  busts: statCount,
  blackjacks: statCount,
  doubles: statCount,
  splits: statCount,
  dealerBustWins: statCount,
  betsPlaced: statCount,
  allInBets: statCount,
  currentWinStreak: statCount,
  bestWinStreak: statCount,
  consecutiveBlackjacks: statCount,
  bestConsecutiveBlackjacks: statCount,
  currentNoBustStreak: statCount,
  bestNoBustStreak: statCount,
  splitWins: statCount,
  doubleWins: statCount,
  highestRunningCount: z.number().int(),
  highestBet: statCount,
  highestLevel: z.number().int().min(1),
});

export const achievementsSchema = z.object({
  stats: lifetimeStatsSchema,
  unlockedIds: z.array(z.string()),
});

/** Per-casino achievement progress added in schema v3. */
export const mapAchievementStateSchema = z.object({
  stats: lifetimeStatsSchema,
  unlockedIds: z.array(z.string()),
});

export const mapAchievementsSchema = z.record(z.string(), mapAchievementStateSchema);

/** Per-mode statistics added in schema v2. */
export const regularStatsSchema = z.object({
  handsPlayed: statCount,
  wins: statCount,
  pushes: statCount,
  losses: statCount,
  blackjacks: statCount,
  /** Net chips over all Regular Mode rounds (can be negative). */
  netChips: z.number().int(),
});

export const quizStatsSchema = z.object({
  questionsAnswered: statCount,
  questionsCorrect: statCount,
  bestStreak: statCount,
  /** Completed 9-in-a-row cycles (each pays the 250-chip reward). */
  cyclesCompleted: statCount,
  chipsEarned: statCount,
});

/** Learn coach count-check stats added in schema v5. */
export const learnStatsSchema = z.object({
  checksAsked: statCount,
  checksCorrect: statCount,
  bestStreak: statCount,
});

export const modeStatsSchema = z.object({
  regular: regularStatsSchema,
  quiz: quizStatsSchema,
  learn: learnStatsSchema,
});

export const saveDataSchema = z.object({
  profile: profileSchema,
  economy: economySchema,
  progression: progressionSchema,
  settings: settingsSchema,
  achievements: achievementsSchema,
  mapAchievements: mapAchievementsSchema,
  modeStats: modeStatsSchema,
});

/** Loose envelope: version + payload. The payload is validated after migration. */
export const saveEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string(),
  data: z.unknown(),
});

export type SaveData = z.infer<typeof saveDataSchema>;
export type SaveEnvelope = z.infer<typeof saveEnvelopeSchema>;
export type RegularStats = z.infer<typeof regularStatsSchema>;
export type QuizStats = z.infer<typeof quizStatsSchema>;
export type LearnStats = z.infer<typeof learnStatsSchema>;
