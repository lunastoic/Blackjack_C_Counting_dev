import { HandResult } from '../blackjack/resolve';

/**
 * Typed gameplay events emitted by the game layer as things happen. The
 * achievement engine folds these into lifetime statistics and unlocks.
 */
export type GameplayEvent =
  | {
      readonly type: 'HAND_COMPLETED';
      readonly result: HandResult;
      readonly wasSplitHand: boolean;
      readonly wasDoubled: boolean;
      readonly playerBusted?: boolean;
    }
  | { readonly type: 'BLACKJACK_HIT' } // natural blackjack
  | { readonly type: 'DOUBLE_USED' }
  | { readonly type: 'SPLIT_USED' }
  | { readonly type: 'PLAYER_WIN'; readonly dealerBusted: boolean }
  | { readonly type: 'PLAYER_PUSH' }
  | { readonly type: 'PLAYER_BUST' }
  | { readonly type: 'DEALER_BUST_WIN' }
  | { readonly type: 'COUNT_REACHED'; readonly runningCount: number }
  | { readonly type: 'BET_PLACED'; readonly amount: number }
  | { readonly type: 'ALL_IN_BET'; readonly amount: number }
  | { readonly type: 'LEVEL_REACHED'; readonly level: number };
