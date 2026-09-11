import { z } from 'zod';

/**
 * Zod schemas for the persisted save. Parsed JSON is NEVER trusted without
 * passing these. Shapes intentionally mirror the engine domain types
 * (GameSettings, LifetimeStats, PlayerProgress) rather than duplicating logic.
 */

export const SAVE_SCHEMA_VERSION = 16;

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

/** Table licenses earned in the Count Sprint, added in schema v6. */
export const tableLicenseSchema = z.union([z.literal('permit'), z.literal('licensed')]);

export const progressionSchema = z.object({
  level: z.number().int().min(1).max(25),
  xpIntoLevel: z.number().int().min(0).max(29),
  unlockedMapIds: z.array(z.number().int().min(1).max(6)).min(1),
  /** mapId (as string) → earned license; absent key = table still closed. */
  licenses: z.record(z.string(), tableLicenseSchema),
});

const countCoachLevelSchema = z.union([
  z.literal('off'),
  z.literal('learn'),
  z.literal('full'),
]);

/** Player-selectable plain deck, added in schema v15. */
const cardDeckSchema = z.union([z.literal('regular'), z.literal('luna')]);

export const settingsSchema = z.object({
  soundEnabled: z.boolean(),
  hapticsEnabled: z.boolean(),
  cardDeck: cardDeckSchema,
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
  trainingMode: z.boolean(),
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

/**
 * Campaign progress added in schema v7. Only lesson and table-night
 * completion live here — drill and boss completion are the table licenses
 * (permit / licensed) already stored in progression.
 */
export const campaignSchema = z.object({
  lessonsDone: z.array(z.number().int().min(1).max(6)),
  nightsDone: z.array(z.number().int().min(1).max(6)),
});

const lessonIdSchema = z.union([
  z.literal('hi-lo-values'),
  z.literal('running-count'),
  z.literal('hole-card-rule'),
  z.literal('true-count'),
  z.literal('count-and-play'),
  z.literal('betting-by-count'),
]);

const drillTypeSchema = z.union([
  z.literal('values'),
  z.literal('running'),
  z.literal('speed'),
]);

export const dojoSchema = z.object({
  completedLessons: z.array(lessonIdSchema),
  totalDojoXp: z.number().int().min(0),
  drillBests: z.record(
    drillTypeSchema,
    z
      .object({
        correct: z.number().int().min(0),
        totalAnswered: z.number().int().min(0),
        accuracy: z.number().min(0).max(1),
        xp: z.number().int().min(0),
      })
      .optional(),
  ),
  dailyStreak: z.number().int().min(0),
  lastPracticeAt: z.number().int().nullable(),
  tableObjectivesCompleted: z.array(z.string()),
  onboardingDone: z.boolean(),
  /** Count Flash ladder (schema v9): "mapId:level" → stars (1–3) once cleared. */
  flashLevels: z.record(z.string(), z.number().int().min(1).max(3)),
  /** One-time "the count carries over" tip after the first correct answer (v10). */
  flashCountTipSeen: z.boolean(),
  /** Best pace per training level (v14): "mapId:level" → right answers per minute. */
  flashPace: z.record(z.string(), z.number().int().min(0)),
});

const rankSchema = z.union([
  z.literal('A'),
  z.literal('2'),
  z.literal('3'),
  z.literal('4'),
  z.literal('5'),
  z.literal('6'),
  z.literal('7'),
  z.literal('8'),
  z.literal('9'),
  z.literal('10'),
  z.literal('J'),
  z.literal('Q'),
  z.literal('K'),
]);

const suitSchema = z.union([
  z.literal('spades'),
  z.literal('hearts'),
  z.literal('diamonds'),
  z.literal('clubs'),
]);

const playerActionSchema = z.union([
  z.literal('hit'),
  z.literal('stand'),
  z.literal('double'),
  z.literal('split'),
]);

/** A hand the player played off-book at the table (v14), newest first. */
export const weakSpotSchema = z.object({
  key: z.string().min(1),
  cards: z.array(z.object({ rank: rankSchema, suit: suitSchema })).min(2),
  dealerUpRank: rankSchema,
  canDouble: z.boolean(),
  canSplit: z.boolean(),
  chosen: playerActionSchema,
  book: playerActionSchema,
  reasonCode: z.string(),
  times: z.number().int().min(1),
  lastAt: z.number().int(),
});

export const weakSpotsSchema = z.object({
  spots: z.array(weakSpotSchema),
});

/** Daily goal progress and the day streak (v14). Day keys are local "YYYY-MM-DD". */
export const dailySchema = z.object({
  dayKey: z.string(),
  progress: z.number().int().min(0),
  streak: z.number().int().min(0),
  lastClaimedDayKey: z.string().nullable(),
});

export const saveDataSchema = z.object({
  profile: profileSchema,
  economy: economySchema,
  progression: progressionSchema,
  settings: settingsSchema,
  achievements: achievementsSchema,
  mapAchievements: mapAchievementsSchema,
  modeStats: modeStatsSchema,
  campaign: campaignSchema,
  dojo: dojoSchema,
  weakSpots: weakSpotsSchema,
  daily: dailySchema,
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
export type DojoSave = z.infer<typeof dojoSchema>;
export type WeakSpotSave = z.infer<typeof weakSpotSchema>;
export type WeakSpotsSave = z.infer<typeof weakSpotsSchema>;
export type DailySave = z.infer<typeof dailySchema>;
