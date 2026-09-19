import { create } from 'zustand';
import { mapById } from '../engine/betting/casino';
import {
  awardDojoXp,
  CLEAR_STARS,
  DAILY_SHOE_CHIPS,
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
  isRewardEarned,
  LessonId,
  nextFlashLevel,
  rankForXp,
  rewardChips,
  rewardKey,
  RewardSlot,
  STAR_COUNT,
  starChips,
} from '../engine/dojo';
import { DojoSave } from '../persistence/schema';
import { useEconomyStore } from './economyStore';
import { awardXpWithRewards } from './orchestration';
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
  /** Mystery rewards opened on the trails, as "mapId:slot". */
  readonly rewardsOpened: ReadonlySet<string>;
  /**
   * Opens a reward that is ready: the gift hands over its table tool, the
   * money bag pays its chips. Returns what it gave, or null when it was not
   * ready (or was already opened).
   */
  readonly openReward: (
    mapId: number,
    slot: RewardSlot,
  ) => { readonly chips: number } | null;
  /** Today's daily shoe: its best edge and accuracy, and whether its chips were paid. */
  readonly dailyShoe: DailyShoeRecord;
  /**
   * Folds a finished daily shoe into today's record (a new day starts fresh)
   * and pays the day's chips on the first run seen through. Returns what it set.
   */
  readonly recordDailyShoe: (
    day: string,
    edge: number,
    accuracy: number,
    backedOff: boolean,
  ) => { readonly edgeIsBest: boolean; readonly chipsPaid: number };
  /** Personal bests per training level: the longest run and the longest combo. */
  readonly flashBests: Readonly<Record<string, TrainingBest>>;
  /**
   * Folds a finished run into the level's bests (each only ever goes up) and
   * says which it beat. A level's first run sets a best but beats nothing.
   */
  readonly recordTrainingBest: (
    mapId: number,
    level: number,
    run: number,
    combo: number,
  ) => { readonly runIsBest: boolean; readonly comboIsBest: boolean };

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

export interface DailyShoeRecord {
  readonly dayKey: string | null;
  /** Units the bets beat a flat bettor by, best run today. */
  readonly bestEdge: number | null;
  readonly bestAccuracy: number | null;
  readonly paid: boolean;
}

const NO_DAILY_SHOE: DailyShoeRecord = { dayKey: null, bestEdge: null, bestAccuracy: null, paid: false };

export interface TrainingBest {
  /** Right answers (streak drills) or checks right (checkpoint levels) in one run. */
  readonly run: number;
  /** Fast right answers in a row. */
  readonly combo: number;
}

export interface TrainingLevelOutcome {
  /** The level's best stars after this run. */
  readonly stars: number;
  /** True the first time this level is cleared (XP is only paid once). */
  readonly firstClear: boolean;
  /** True when this clear completed the ladder (and so opened the next casino). */
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
  flashBests: {},
  rewardsOpened: new Set<string>(),
  dailyShoe: NO_DAILY_SHOE,

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

  openReward: (mapId, slot) => {
    const key = rewardKey(mapId, slot);
    if (get().rewardsOpened.has(key) || !isRewardEarned(get().flashLevels, mapId, slot)) {
      return null;
    }
    const chips = slot === 2 ? rewardChips(mapId) : 0;
    if (chips > 0) {
      useEconomyStore.getState().creditChips(chips);
    }
    set({ rewardsOpened: new Set([...get().rewardsOpened, key]) });
    return { chips };
  },

  recordDailyShoe: (day, edge, accuracy, backedOff) => {
    const current = get().dailyShoe.dayKey === day ? get().dailyShoe : { ...NO_DAILY_SHOE, dayKey: day };
    if (backedOff) {
      set({ dailyShoe: current });
      return { edgeIsBest: false, chipsPaid: 0 };
    }
    const edgeIsBest = current.bestEdge === null || edge > current.bestEdge;
    const chipsPaid = current.paid ? 0 : DAILY_SHOE_CHIPS;
    if (chipsPaid > 0) {
      useEconomyStore.getState().creditChips(chipsPaid);
    }
    set({
      dailyShoe: {
        dayKey: day,
        bestEdge: edgeIsBest ? edge : current.bestEdge,
        bestAccuracy: Math.max(current.bestAccuracy ?? 0, accuracy),
        paid: true,
      },
    });
    return { edgeIsBest, chipsPaid };
  },

  recordTrainingBest: (mapId, level, run, combo) => {
    const key = flashLevelKey(mapId, level);
    const previous = get().flashBests[key];
    const next = {
      run: Math.max(previous?.run ?? 0, Math.max(0, Math.round(run))),
      combo: Math.max(previous?.combo ?? 0, Math.max(0, Math.round(combo))),
    };
    if (!previous || next.run !== previous.run || next.combo !== previous.combo) {
      set({ flashBests: { ...get().flashBests, [key]: next } });
    }
    return {
      runIsBest: previous !== undefined && run > previous.run,
      comboIsBest: previous !== undefined && combo > previous.combo,
    };
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
    awardXpWithRewards(DOJO_XP.lessonComplete);
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
    awardXpWithRewards(xp);

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
    awardXpWithRewards(DOJO_XP.objectiveComplete);
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
      flashBests: {},
      rewardsOpened: new Set<string>(),
      dailyShoe: NO_DAILY_SHOE,
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
      awardXpWithRewards(DOJO_XP.flashLevel);
      set({ totalDojoXp: progression.dojoXp, rank: progression.rank });
    }
    set({ flashLevels: { ...get().flashLevels, [key]: stars } });

    const nowComplete = isMapFlashComplete(get().flashLevels, mapId);
    const tableUnlocked = nowComplete && !wasComplete;
    if (nowComplete) {
      // The free path to the next casino; buying it early is progressionStore.buyMap.
      useProgressionStore.getState().unlockMap(mapId + 1);
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
      flashBests: { ...data.flashBests },
      dailyShoe: { ...data.dailyShoe },
      rewardsOpened: new Set(data.rewardsOpened),
    }),
}));
