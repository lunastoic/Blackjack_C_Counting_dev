import { STARTING_BANKROLL } from '../engine/betting/casino';
import { INITIAL_PROGRESS } from '../engine/progression/progression';
import { INITIAL_STATS } from '../engine/achievements/stats';
import { DEFAULT_SETTINGS } from '../engine/types';
import { DEFAULT_DISPLAY_NAME, SaveData } from './schema';

function createEmptyMapAchievements(): SaveData['mapAchievements'] {
  const mapAchievements: SaveData['mapAchievements'] = {};
  for (let mapId = 1; mapId <= 6; mapId++) {
    mapAchievements[String(mapId)] = {
      stats: { ...INITIAL_STATS },
      unlockedIds: [],
    };
  }
  return mapAchievements;
}

/** Fresh install: 500 chips, level 1, map 1 unlocked, spec-default settings. */
export function createDefaultSave(): SaveData {
  return {
    profile: {
      displayName: DEFAULT_DISPLAY_NAME,
      createdAt: null,
    },
    economy: {
      chips: STARTING_BANKROLL,
      lastBet: 0,
      dailyRewardClaimedAt: null,
      adRewardClaimedAt: null,
    },
    progression: {
      level: INITIAL_PROGRESS.level,
      xpIntoLevel: INITIAL_PROGRESS.xpIntoLevel,
      unlockedMapIds: [1],
    },
    settings: {
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      hapticsEnabled: DEFAULT_SETTINGS.hapticsEnabled,
      dealerSpeed: DEFAULT_SETTINGS.dealerSpeed,
      deckCounts: { ...DEFAULT_SETTINGS.deckCounts },
      trainingAids: { ...DEFAULT_SETTINGS.trainingAids },
      countCoachLevel: DEFAULT_SETTINGS.countCoachLevel,
      reducedMotion: DEFAULT_SETTINGS.reducedMotion,
    },
    achievements: {
      stats: { ...INITIAL_STATS },
      unlockedIds: [],
    },
    mapAchievements: createEmptyMapAchievements(),
    modeStats: {
      regular: { handsPlayed: 0, wins: 0, pushes: 0, losses: 0, blackjacks: 0, netChips: 0 },
      quiz: {
        questionsAnswered: 0,
        questionsCorrect: 0,
        bestStreak: 0,
        cyclesCompleted: 0,
        chipsEarned: 0,
      },
      learn: { checksAsked: 0, checksCorrect: 0, bestStreak: 0 },
    },
  };
}
