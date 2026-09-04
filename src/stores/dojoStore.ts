import { create } from 'zustand';
import {
  awardDojoXp,
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
} from '../engine/dojo';
import { DojoSave } from '../persistence/schema';
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
  /** Count Flash ladder: "mapId:level" → stars once cleared. */
  readonly flashLevels: FlashProgress;
  /** The one-time "count carries over" tip has been acknowledged. */
  readonly flashCountTipSeen: boolean;
  readonly markFlashCountTipSeen: () => void;

  readonly startOnboarding: () => void;
  readonly finishOnboarding: () => void;
  readonly completeLesson: (lessonId: LessonId) => DojoProgressionResult;
  readonly recordDrillResult: (type: DrillType, result: DrillResult) => DojoProgressionResult;
  readonly recordObjective: (objectiveId: string) => DojoProgressionResult | null;
  readonly touchPractice: () => void;
  readonly resetProgress: () => void;
  readonly isLessonUnlocked: (lessonId: LessonId) => boolean;
  /**
   * Records a cleared training level with the stars the run earned (stars
   * only ever go up). Clearing the sixth level licenses the casino's table
   * and opens the next casino.
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
  readonly stars: number;
  /** True the first time this level is cleared (XP is only paid once). */
  readonly firstClear: boolean;
  /** True when this clear completed the ladder and opened the table. */
  readonly tableUnlocked: boolean;
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

  markFlashCountTipSeen: () => set({ flashCountTipSeen: true }),

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
    }),

  isLessonUnlocked: (lessonId) =>
    isLessonUnlocked(lessonId, get().completedLessons, get().rank.index),

  completeTrainingLevel: (mapId, level, earned) => {
    const key = flashLevelKey(mapId, level);
    const previousStars = get().flashLevels[key] ?? 0;
    const stars = Math.max(previousStars, Math.min(3, Math.max(1, Math.round(earned))));
    const firstClear = previousStars === 0;
    const wasComplete = isMapFlashComplete(get().flashLevels, mapId);

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
    return { stars, firstClear, tableUnlocked, progression };
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
    }),
}));
