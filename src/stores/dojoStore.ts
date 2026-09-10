import { create } from 'zustand';
import { mapById } from '../engine/betting/casino';
import {
  awardDojoXp,
  CLEAR_STARS,
  DojoProgressionResult,
  DojoRank,
  DOJO_XP,
  DrillResult,
  DrillType,
  flashLevelKey,
  FlashProgress,
  isFlashLevelUnlocked,
  isLessonUnlocked,
  isMapFlashComplete,
  LessonId,
  nextFlashLevel,
  rankForXp,
  STAR_COUNT,
  starChips,
} from '../engine/dojo';
import { DojoSave } from '../persistence/schema';
import { useEconomyStore } from './economyStore';
import { useProgressionStore } from './progressionStore';

export interface DojoState {
  readonly completedLessons: ReadonlySet<LessonId>;
  readonly totalDojoXp: number;
  readonly rank: DojoRank;
  readonly drillBests: Readonly<Record<DrillType, DrillResult | undefined>>;
  readonly dailyStreak: number;
  readonly lastPracticeAt: number | null;
  readonly tableObjectivesCompleted: ReadonlySet<string>;
  readonly onboardingDone: boolean;
  /** Count Flash ladder: "mapId:level" → best stars (two clear the level). */
  readonly flashLevels: FlashProgress;
  /** The one-time "count carries over" tip has been acknowledged. */
  readonly flashCountTipSeen: boolean;
  readonly markFlashCountTipSeen: () => void;
  /** Best pace per training level: "mapId:level" → right answers per minute. */
  readonly flashPace: Readonly<Record<string, number>>;
  /**
   * Records a clearing run's pace; the best only ever goes up. Returns true
   * when this run set a new best for the level.
   */
  readonly recordTrainingPace: (mapId: number, level: number, pace: number) => boolean;

  readonly startOnboarding: () => void;
  readonly finishOnboarding: () => void;
  readonly completeLesson: (lessonId: LessonId) => DojoProgressionResult;
  readonly recordDrillResult: (type: DrillType, result: DrillResult) => DojoProgressionResult;
  readonly recordObjective: (objectiveId: string) => DojoProgressionResult | null;
  readonly touchPractice: () => void;
  readonly resetProgress: () => void;
  readonly isLessonUnlocked: (lessonId: LessonId) => boolean;
  /**
   * Records a training run's stars (best only ever goes up) and pays chips
   * for each star the level has not paid before. Two stars clear the level;
   * two on the sixth license the casino's table and open the next casino.
   */
  readonly completeTrainingLevel: (
    mapId: number,
    level: number,
    stars: number,
  ) => TrainingLevelOutcome;
  readonly isFlashLevelUnlocked: (mapId: number, level: number) => boolean;
  readonly nextFlashLevel: (mapId: number) => number | null;
  readonly isMapFlashComplete: (mapId: number) => boolean;
  readonly hydrate: (data: DojoSave) => void;
}

export interface TrainingLevelOutcome {
  /** The level's best stars after this run. */
  readonly stars: number;
  /** True the first time this level is cleared (XP is only paid once). */
  readonly firstClear: boolean;
  /** True when this clear completed the ladder and opened the table. */
  readonly tableUnlocked: boolean;
  /** Chips paid for the stars this run earned for the first time. */
  readonly chipsAwarded: number;
  readonly progression: DojoProgressionResult | null;
}

function emptyBests(): Record<DrillType, DrillResult | undefined> {
  return { values: undefined, running: undefined, speed: undefined };
}

export const useDojoStore = create<DojoState>()((set, get) => ({
  completedLessons: new Set(),
  totalDojoXp: 0,
  rank: rankForXp(0),
  drillBests: emptyBests(),
  dailyStreak: 0,
  lastPracticeAt: null,
  tableObjectivesCompleted: new Set(),
  onboardingDone: false,
  flashLevels: {},
  flashCountTipSeen: false,
  flashPace: {},

  markFlashCountTipSeen: () => set({ flashCountTipSeen: true }),

  recordTrainingPace: (mapId, level, pace) => {
    const key = flashLevelKey(mapId, level);
    const rounded = Math.max(0, Math.round(pace));
    const previous = get().flashPace[key] ?? 0;
    if (rounded <= previous) {
      return false;
    }
    set({ flashPace: { ...get().flashPace, [key]: rounded } });
    return true;
  },

  startOnboarding: () => set({ onboardingDone: false }),
  finishOnboarding: () => set({ onboardingDone: true }),

  completeLesson: (lessonId) => {
    if (get().completedLessons.has(lessonId)) {
      const progress = useProgressionStore.getState();
      return {
        dojoXp: get().totalDojoXp,
        rank: get().rank,
        didRankUp: false,
        progression: {
          previousLevel: progress.level,
          newLevel: progress.level,
          previousXp: progress.xpIntoLevel,
          newXp: progress.xpIntoLevel,
          levelsGained: 0,
          chipReward: 0,
          progress: { level: progress.level, xpIntoLevel: progress.xpIntoLevel },
        },
      };
    }
    const progress = useProgressionStore.getState();
    const outcome = awardDojoXp(
      { level: progress.level, xpIntoLevel: progress.xpIntoLevel },
      get().totalDojoXp,
      DOJO_XP.lessonComplete,
    );
    progress.awardXp(DOJO_XP.lessonComplete);
    set({
      completedLessons: new Set([...get().completedLessons, lessonId]),
      totalDojoXp: outcome.dojoXp,
      rank: outcome.rank,
    });
    return outcome;
  },

  recordDrillResult: (type, result) => {
    const currentBest = get().drillBests[type];
    const isBetter =
      !currentBest ||
      result.accuracy > currentBest.accuracy ||
      (result.accuracy === currentBest.accuracy && result.correct > currentBest.correct);

    const progress = useProgressionStore.getState();
    const xp = result.xp;
    const outcome = awardDojoXp(
      { level: progress.level, xpIntoLevel: progress.xpIntoLevel },
      get().totalDojoXp,
      xp,
    );
    progress.awardXp(xp);

    set({
      drillBests: isBetter
        ? { ...get().drillBests, [type]: result }
        : get().drillBests,
      totalDojoXp: outcome.dojoXp,
      rank: outcome.rank,
    });
    return outcome;
  },

  recordObjective: (objectiveId) => {
    if (get().tableObjectivesCompleted.has(objectiveId)) {
      return null;
    }
    const progress = useProgressionStore.getState();
    const outcome = awardDojoXp(
      { level: progress.level, xpIntoLevel: progress.xpIntoLevel },
      get().totalDojoXp,
      DOJO_XP.objectiveComplete,
    );
    progress.awardXp(DOJO_XP.objectiveComplete);
    set({
      tableObjectivesCompleted: new Set([...get().tableObjectivesCompleted, objectiveId]),
      totalDojoXp: outcome.dojoXp,
      rank: outcome.rank,
    });
    return outcome;
  },

  touchPractice: () => {
    const now = Date.now();
    const last = get().lastPracticeAt;
    let streak = get().dailyStreak;
    if (last !== null) {
      const oneDay = 24 * 60 * 60 * 1000;
      const elapsed = now - last;
      if (elapsed >= oneDay && elapsed < 2 * oneDay) {
        streak += 1;
      } else if (elapsed >= 2 * oneDay) {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    set({ lastPracticeAt: now, dailyStreak: streak });
  },

  resetProgress: () =>
    set({
      completedLessons: new Set(),
      totalDojoXp: 0,
      rank: rankForXp(0),
      drillBests: emptyBests(),
      dailyStreak: 0,
      lastPracticeAt: null,
      tableObjectivesCompleted: new Set(),
      flashLevels: {},
      flashCountTipSeen: false,
      flashPace: {},
    }),

  isLessonUnlocked: (lessonId) =>
    isLessonUnlocked(lessonId, get().completedLessons, get().rank.index),

  completeTrainingLevel: (mapId, level, earned) => {
    const key = flashLevelKey(mapId, level);
    const previousStars = get().flashLevels[key] ?? 0;
    const stars = Math.max(previousStars, Math.min(STAR_COUNT, Math.max(1, Math.round(earned))));
    const firstClear = previousStars < CLEAR_STARS && stars >= CLEAR_STARS;
    const wasComplete = isMapFlashComplete(get().flashLevels, mapId);

    // Each star pays once, scaled to the casino's table.
    const maxBet = mapById(mapId)?.maxBet ?? 0;
    let chipsAwarded = 0;
    for (let star = previousStars + 1; star <= stars; star += 1) {
      chipsAwarded += starChips(maxBet, star);
    }
    if (chipsAwarded > 0) {
      useEconomyStore.getState().creditChips(chipsAwarded);
    }

    let progression: DojoProgressionResult | null = null;
    if (firstClear) {
      const progress = useProgressionStore.getState();
      progression = awardDojoXp(
        { level: progress.level, xpIntoLevel: progress.xpIntoLevel },
        get().totalDojoXp,
        DOJO_XP.flashLevel,
      );
      progress.awardXp(DOJO_XP.flashLevel);
      set({ totalDojoXp: progression.dojoXp, rank: progression.rank });
    }
    set({ flashLevels: { ...get().flashLevels, [key]: stars } });

    const nowComplete = isMapFlashComplete(get().flashLevels, mapId);
    const tableUnlocked = nowComplete && !wasComplete;
    if (nowComplete) {
      const progress = useProgressionStore.getState();
      progress.grantLicense(mapId, 'licensed');
      progress.unlockMap(mapId + 1);
    }
    return { stars, firstClear, tableUnlocked, chipsAwarded, progression };
  },

  isFlashLevelUnlocked: (mapId, level) => isFlashLevelUnlocked(get().flashLevels, mapId, level),
  nextFlashLevel: (mapId) => nextFlashLevel(get().flashLevels, mapId),
  isMapFlashComplete: (mapId) => isMapFlashComplete(get().flashLevels, mapId),

  hydrate: (data) =>
    set({
      completedLessons: new Set(data.completedLessons),
      totalDojoXp: data.totalDojoXp,
      rank: rankForXp(data.totalDojoXp),
      drillBests: { ...emptyBests(), ...data.drillBests },
      dailyStreak: data.dailyStreak,
      lastPracticeAt: data.lastPracticeAt,
      tableObjectivesCompleted: new Set(data.tableObjectivesCompleted),
      onboardingDone: data.onboardingDone,
      flashLevels: { ...data.flashLevels },
      flashCountTipSeen: data.flashCountTipSeen,
      flashPace: { ...data.flashPace },
    }),
}));
