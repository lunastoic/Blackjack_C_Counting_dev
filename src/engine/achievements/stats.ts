import { GameplayEvent } from './events';

/** Lifetime statistics accumulated across every session. All integers. */
export interface LifetimeStats {
  readonly handsPlayed: number;
  readonly wins: number;
  readonly pushes: number;
  readonly losses: number;
  readonly busts: number;
  readonly blackjacks: number;
  readonly doubles: number;
  readonly splits: number;
  readonly dealerBustWins: number;
  readonly betsPlaced: number;
  readonly allInBets: number;
  readonly currentWinStreak: number;
  readonly bestWinStreak: number;
  readonly consecutiveBlackjacks: number;
  readonly bestConsecutiveBlackjacks: number;
  readonly currentNoBustStreak: number;
  readonly bestNoBustStreak: number;
  readonly splitWins: number;
  readonly doubleWins: number;
  readonly highestRunningCount: number;
  readonly highestBet: number;
  readonly highestLevel: number;
}

export const INITIAL_STATS: LifetimeStats = {
  handsPlayed: 0,
  wins: 0,
  pushes: 0,
  losses: 0,
  busts: 0,
  blackjacks: 0,
  doubles: 0,
  splits: 0,
  dealerBustWins: 0,
  betsPlaced: 0,
  allInBets: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  consecutiveBlackjacks: 0,
  bestConsecutiveBlackjacks: 0,
  currentNoBustStreak: 0,
  bestNoBustStreak: 0,
  splitWins: 0,
  doubleWins: 0,
  highestRunningCount: 0,
  highestBet: 0,
  highestLevel: 1,
};

export function applyEventToStats(stats: LifetimeStats, event: GameplayEvent): LifetimeStats {
  switch (event.type) {
    case 'HAND_COMPLETED': {
      const won = event.result === 'win' || event.result === 'blackjack';
      const isBlackjack = event.result === 'blackjack';
      const currentWinStreak = won ? stats.currentWinStreak + 1 : 0;
      const consecutiveBlackjacks = isBlackjack ? stats.consecutiveBlackjacks + 1 : 0;
      const currentNoBustStreak = event.playerBusted ? 0 : stats.currentNoBustStreak + 1;
      return {
        ...stats,
        handsPlayed: stats.handsPlayed + 1,
        wins: won ? stats.wins + 1 : stats.wins,
        pushes: event.result === 'push' ? stats.pushes + 1 : stats.pushes,
        losses: event.result === 'loss' ? stats.losses + 1 : stats.losses,
        currentWinStreak,
        bestWinStreak: Math.max(stats.bestWinStreak, currentWinStreak),
        consecutiveBlackjacks,
        bestConsecutiveBlackjacks: Math.max(stats.bestConsecutiveBlackjacks, consecutiveBlackjacks),
        currentNoBustStreak,
        bestNoBustStreak: Math.max(stats.bestNoBustStreak, currentNoBustStreak),
        splitWins: stats.splitWins + (won && event.wasSplitHand ? 1 : 0),
        doubleWins: stats.doubleWins + (won && event.wasDoubled ? 1 : 0),
      };
    }
    case 'BLACKJACK_HIT':
      return { ...stats, blackjacks: stats.blackjacks + 1 };
    case 'DOUBLE_USED':
      return { ...stats, doubles: stats.doubles + 1 };
    case 'SPLIT_USED':
      return { ...stats, splits: stats.splits + 1 };
    // Wins/pushes are counted via HAND_COMPLETED; DEALER_BUST_WIN is the sole
    // signal for dealer-bust wins so emitting PLAYER_WIN alongside it can
    // never double-count.
    case 'PLAYER_WIN':
    case 'PLAYER_PUSH':
      return stats;
    case 'PLAYER_BUST':
      return { ...stats, busts: stats.busts + 1 };
    case 'DEALER_BUST_WIN':
      return { ...stats, dealerBustWins: stats.dealerBustWins + 1 };
    case 'COUNT_REACHED':
      return {
        ...stats,
        highestRunningCount: Math.max(stats.highestRunningCount, event.runningCount),
      };
    case 'BET_PLACED':
      return {
        ...stats,
        betsPlaced: stats.betsPlaced + 1,
        highestBet: Math.max(stats.highestBet, event.amount),
      };
    case 'ALL_IN_BET':
      return {
        ...stats,
        allInBets: stats.allInBets + 1,
        highestBet: Math.max(stats.highestBet, event.amount),
      };
    case 'LEVEL_REACHED':
      return { ...stats, highestLevel: Math.max(stats.highestLevel, event.level) };
  }
}
