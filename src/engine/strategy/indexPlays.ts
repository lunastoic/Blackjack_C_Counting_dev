import { blackjackValue, Card, Rank } from '../cards/card';
import { evaluateCards, isEqualSplitValue } from '../hand/evaluate';
import { PlayerAction } from '../blackjack/rules';
import { dealerUpValue } from './recommend';
import { ActionAvailability } from './types';

/**
 * Index plays: the handful of spots where the true count, not the chart,
 * decides the play. These are the "Illustrious 18" for a multi-deck shoe,
 * dealer stands on soft 17 — each with the true count (rounded down) at
 * which the deviation takes over. Insurance leads the list; it is worth
 * more than any other.
 */
export interface IndexPlay {
  readonly id: string;
  /** "16 vs 10". */
  readonly label: string;
  /** Hard total the play is for, or 'pair10' for two ten-value cards. */
  readonly hand: number | 'pair10';
  /** Dealer upcard value, Ace as 11. */
  readonly up: number;
  /** The deviation. */
  readonly action: PlayerAction;
  /** The chart's play below the index. */
  readonly below: PlayerAction;
  /** Deviate at this true count or higher. */
  readonly index: number;
}

/** Take insurance at this true count or higher. */
export const INSURANCE_INDEX = 3;

export const INDEX_PLAYS: readonly IndexPlay[] = [
  { id: '16v10', label: '16 vs 10', hand: 16, up: 10, action: 'stand', below: 'hit', index: 0 },
  { id: '15v10', label: '15 vs 10', hand: 15, up: 10, action: 'stand', below: 'hit', index: 4 },
  { id: 'TTv5', label: '10,10 vs 5', hand: 'pair10', up: 5, action: 'split', below: 'stand', index: 5 },
  { id: 'TTv6', label: '10,10 vs 6', hand: 'pair10', up: 6, action: 'split', below: 'stand', index: 4 },
  { id: '10v10', label: '10 vs 10', hand: 10, up: 10, action: 'double', below: 'hit', index: 4 },
  { id: '12v3', label: '12 vs 3', hand: 12, up: 3, action: 'stand', below: 'hit', index: 2 },
  { id: '12v2', label: '12 vs 2', hand: 12, up: 2, action: 'stand', below: 'hit', index: 3 },
  { id: '11vA', label: '11 vs A', hand: 11, up: 11, action: 'double', below: 'hit', index: 1 },
  { id: '9v2', label: '9 vs 2', hand: 9, up: 2, action: 'double', below: 'hit', index: 1 },
  { id: '10vA', label: '10 vs A', hand: 10, up: 11, action: 'double', below: 'hit', index: 4 },
  { id: '9v7', label: '9 vs 7', hand: 9, up: 7, action: 'double', below: 'hit', index: 3 },
  { id: '16v9', label: '16 vs 9', hand: 16, up: 9, action: 'stand', below: 'hit', index: 5 },
  { id: '13v2', label: '13 vs 2', hand: 13, up: 2, action: 'stand', below: 'hit', index: -1 },
  { id: '12v4', label: '12 vs 4', hand: 12, up: 4, action: 'stand', below: 'hit', index: 0 },
  { id: '12v5', label: '12 vs 5', hand: 12, up: 5, action: 'stand', below: 'hit', index: -2 },
  { id: '12v6', label: '12 vs 6', hand: 12, up: 6, action: 'stand', below: 'hit', index: -1 },
  { id: '13v3', label: '13 vs 3', hand: 13, up: 3, action: 'stand', below: 'hit', index: -2 },
];

/** The six worth learning first, insurance aside. */
export const TOP_INDEX_PLAY_IDS: readonly string[] = ['16v10', '15v10', 'TTv5', 'TTv6', '10v10', '12v3'];

/** Whether to take insurance at this true count. */
export function shouldTakeInsurance(trueCount: number): boolean {
  return Math.floor(trueCount) >= INSURANCE_INDEX;
}

/** The index play that covers this hand against this upcard, if any. */
export function indexPlayFor(
  cards: readonly Pick<Card, 'rank'>[],
  dealerUpRank: Rank,
  plays: readonly IndexPlay[] = INDEX_PLAYS,
): IndexPlay | null {
  const up = dealerUpValue(dealerUpRank);
  const pairOfTens =
    cards.length === 2 &&
    isEqualSplitValue(cards[0].rank, cards[1].rank) &&
    blackjackValue(cards[0].rank) === 10;
  const { total, isSoft } = evaluateCards(cards);
  return (
    plays.find((play) => {
      if (play.up !== up) {
        return false;
      }
      if (play.hand === 'pair10') {
        return pairOfTens;
      }
      // Two tens are a pair spot, never "hard 20"; soft hands play the chart.
      return !isSoft && !pairOfTens && total === play.hand;
    }) ?? null
  );
}

/**
 * The play at this true count for a spot an index covers: `action` at the
 * index or higher, `below` under it. An unavailable double falls back to a
 * hit, an unavailable split to a stand.
 */
export function indexAction(
  play: IndexPlay,
  trueCount: number,
  availability: ActionAvailability,
): PlayerAction {
  const deviate = Math.floor(trueCount) >= play.index;
  const action = deviate ? play.action : play.below;
  if (action === 'double' && !availability.canDouble) {
    return 'hit';
  }
  if (action === 'split' && !availability.canSplit) {
    return 'stand';
  }
  return action;
}
