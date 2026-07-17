import { INITIAL_STATS } from '../engine/achievements/stats';
import { SAVE_SCHEMA_VERSION } from './schema';

/**
 * Migration ladder: `migrations[n]` upgrades a version-n payload to n+1.
 *
 * NOTE: interrupted rounds are NOT persisted. If the app dies mid-round, the
 * next launch restarts safely at the betting phase with the saved bankroll.
 */
export type Migration = (data: unknown) => unknown;

/** v1 → v2: adds per-mode (Regular / Quiz) statistics with zeroed defaults. */
function migrateV1toV2(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  return {
    ...save,
    modeStats: {
      regular: { handsPlayed: 0, wins: 0, pushes: 0, losses: 0, blackjacks: 0, netChips: 0 },
      quiz: {
        questionsAnswered: 0,
        questionsCorrect: 0,
        bestStreak: 0,
        cyclesCompleted: 0,
        chipsEarned: 0,
      },
    },
  };
}

/** v2 → v3: per-casino achievement slices + extended lifetime stat fields. */
function migrateV2toV3(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const achievements = (save.achievements ?? {}) as Record<string, unknown>;
  const legacyStats = (achievements.stats as Record<string, unknown> | undefined) ?? {};
  const stats = { ...INITIAL_STATS, ...legacyStats };
  const mapAchievements: Record<string, { stats: typeof stats; unlockedIds: string[] }> = {};
  for (let mapId = 1; mapId <= 6; mapId++) {
    mapAchievements[String(mapId)] = {
      stats: { ...stats },
      unlockedIds: [],
    };
  }
  return {
    ...save,
    achievements: {
      stats,
      unlockedIds: Array.isArray(achievements.unlockedIds) ? achievements.unlockedIds : [],
    },
    mapAchievements,
  };
}

/** v3 → v4: Regular Mode Count Coach level (default Off). */
function migrateV3toV4(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const settings = (save.settings ?? {}) as Record<string, unknown>;
  return {
    ...save,
    settings: {
      ...settings,
      countCoachLevel: 'off',
    },
  };
}

/**
 * v4 → v5: Training Mode merged into Regular Mode.
 * - deckCounts drops the training key (regular becomes the one table setting).
 * - Count Coach collapses to off / learn / full: light and guided both map to
 *   the new Learn level; off and full carry over.
 * - Adds zeroed Learn count-check stats.
 */
function migrateV4toV5(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const settings = (save.settings ?? {}) as Record<string, unknown>;
  const deckCounts = (settings.deckCounts ?? {}) as Record<string, unknown>;
  const coach = settings.countCoachLevel;
  const modeStats = (save.modeStats ?? {}) as Record<string, unknown>;
  return {
    ...save,
    settings: {
      ...settings,
      deckCounts: {
        regular: deckCounts.regular ?? 6,
        quiz: deckCounts.quiz ?? 6,
      },
      countCoachLevel:
        coach === 'light' || coach === 'guided'
          ? 'learn'
          : coach === 'full'
            ? 'full'
            : 'off',
    },
    modeStats: {
      ...modeStats,
      learn: { checksAsked: 0, checksCorrect: 0, bestStreak: 0 },
    },
  };
}

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
};

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Runs the ladder from `fromVersion` up to the current schema version.
 * Throws MigrationError when a step is missing or fails — callers fall back
 * to defaults rather than crashing.
 */
export function runMigrations(
  data: unknown,
  fromVersion: number,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion: number = SAVE_SCHEMA_VERSION,
): unknown {
  if (fromVersion > targetVersion) {
    throw new MigrationError(
      `Save version ${fromVersion} is newer than supported version ${targetVersion}`,
    );
  }
  let current = data;
  for (let version = fromVersion; version < targetVersion; version++) {
    const step = migrations[version];
    if (!step) {
      throw new MigrationError(`No migration registered for version ${version}`);
    }
    current = step(current);
  }
  return current;
}
