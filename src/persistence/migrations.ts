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

/**
 * v5 → v6: table licenses (quiz-first progression).
 * Grandfathering: anyone who has already played table hands earned their
 * seat the old way — every casino they unlocked becomes fully licensed so
 * the update never locks a player out of a table they were using.
 */
function migrateV5toV6(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const progression = (save.progression ?? {}) as Record<string, unknown>;
  const modeStats = (save.modeStats ?? {}) as Record<string, unknown>;
  const regular = (modeStats.regular ?? {}) as Record<string, unknown>;
  const handsPlayed = typeof regular.handsPlayed === 'number' ? regular.handsPlayed : 0;
  const unlockedMapIds = Array.isArray(progression.unlockedMapIds)
    ? progression.unlockedMapIds
    : [1];

  const licenses: Record<string, 'licensed'> = {};
  if (handsPlayed > 0) {
    for (const mapId of unlockedMapIds) {
      licenses[String(mapId)] = 'licensed';
    }
  }
  return {
    ...save,
    progression: {
      ...progression,
      licenses,
    },
  };
}

/**
 * v6 → v7: campaign progress (journey map).
 * Grandfathering from licenses: a licensed casino means the player already
 * proved everything that chapter teaches → its lesson and night count as
 * done. A permit means they at least worked through the early material →
 * the lesson counts as done.
 */
function migrateV6toV7(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const progression = (save.progression ?? {}) as Record<string, unknown>;
  const licenses = (progression.licenses ?? {}) as Record<string, unknown>;

  const lessonsDone: number[] = [];
  const nightsDone: number[] = [];
  for (const [mapId, license] of Object.entries(licenses)) {
    const id = Number(mapId);
    if (!Number.isInteger(id)) {
      continue;
    }
    if (license === 'licensed') {
      lessonsDone.push(id);
      nightsDone.push(id);
    } else if (license === 'permit') {
      lessonsDone.push(id);
    }
  }
  return {
    ...save,
    campaign: { lessonsDone, nightsDone },
  };
}

/**
 * v7 → v8: Counting Dojo progress.
 * Adds lesson completion, dojo XP, drill bests, daily streak, and onboarding flag.
 */
function migrateV7toV8(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  return {
    ...save,
    dojo: {
      completedLessons: [],
      totalDojoXp: 0,
      drillBests: {},
      dailyStreak: 0,
      lastPracticeAt: null,
      tableObjectivesCompleted: [],
      onboardingDone: false,
    },
  };
}

/**
 * v8 → v9: Count Flash ladder progress (six levels per casino gate the table).
 * Grandfathering: a casino that is already licensed had its table earned the
 * old way — every flash level counts as cleared (3 stars) so the update never
 * closes a table the player was using.
 */
function migrateV8toV9(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const dojo = (save.dojo ?? {}) as Record<string, unknown>;
  const progression = (save.progression ?? {}) as Record<string, unknown>;
  const licenses = (progression.licenses ?? {}) as Record<string, unknown>;

  const flashLevels: Record<string, number> = {};
  for (const [mapId, license] of Object.entries(licenses)) {
    if (license !== 'licensed' || !Number.isInteger(Number(mapId))) {
      continue;
    }
    for (let level = 1; level <= 6; level++) {
      flashLevels[`${Number(mapId)}:${level}`] = 3;
    }
  }
  return {
    ...save,
    dojo: {
      ...dojo,
      flashLevels,
    },
  };
}

/** v9 → v10: the one-time Count Flash "count carries over" tip flag. */
function migrateV9toV10(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const dojo = (save.dojo ?? {}) as Record<string, unknown>;
  return {
    ...save,
    dojo: {
      ...dojo,
      flashCountTipSeen: false,
    },
  };
}

/**
 * v10 → v11: the six placeholder Count Flash levels became the count training
 * ladder (values → combos → groups → running count → full deck → blackjack
 * count test, the original drill). Cleared level N still credits level N so
 * nobody loses their place; anything not reachable from level 1 is dropped
 * and stars are clamped to 1–3.
 */
function migrateV10toV11(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const dojo = (save.dojo ?? {}) as Record<string, unknown>;
  const legacy = (dojo.flashLevels ?? {}) as Record<string, unknown>;
  const flashLevels: Record<string, number> = {};
  const mapIds = new Set<number>();
  for (const key of Object.keys(legacy)) {
    const mapId = Number(key.split(':')[0]);
    if (Number.isInteger(mapId) && mapId > 0) {
      mapIds.add(mapId);
    }
  }
  for (const mapId of mapIds) {
    for (let level = 1; level <= 6; level++) {
      const stars = legacy[`${mapId}:${level}`];
      if (typeof stars !== 'number' || !(stars > 0)) {
        break;
      }
      flashLevels[`${mapId}:${level}`] = Math.min(3, Math.max(1, Math.round(stars)));
    }
  }
  return {
    ...save,
    dojo: {
      ...dojo,
      flashLevels,
    },
  };
}

/**
 * v11 → v12: the table-side Training Mode switch. Existing players keep the
 * aids they already had on screen, so the switch starts on.
 */
function migrateV11toV12(data: unknown): unknown {
  const save = (data ?? {}) as Record<string, unknown>;
  const settings = (save.settings ?? {}) as Record<string, unknown>;
  return {
    ...save,
    settings: {
      ...settings,
      trainingMode: true,
    },
  };
}

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
  5: migrateV5toV6,
  6: migrateV6toV7,
  7: migrateV7toV8,
  8: migrateV8toV9,
  9: migrateV9toV10,
  10: migrateV10toV11,
  11: migrateV11toV12,
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
