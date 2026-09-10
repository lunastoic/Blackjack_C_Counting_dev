import { blackjackValue, Card, Rank } from '../cards/card';
import { evaluateCards, isEqualSplitValue } from '../hand/evaluate';
import { PlayerAction } from '../blackjack/rules';

/**
 * Plain words for a strategy situation — "Hard 16", "Soft 18", "Pair of 8s"
 * — so the deviation toast and the weak-spot drill can name a hand the way
 * the strategy chart does.
 */
export function handLabel(cards: readonly Pick<Card, 'rank'>[]): string {
  if (cards.length === 2 && isEqualSplitValue(cards[0].rank, cards[1].rank)) {
    const value = blackjackValue(cards[0].rank);
    if (value === 11) {
      return 'Pair of aces';
    }
    return value === 10 ? 'Pair of tens' : `Pair of ${value}s`;
  }
  const { total, isSoft } = evaluateCards(cards);
  return `${isSoft ? 'Soft' : 'Hard'} ${total}`;
}

export const ACTION_LABELS: Record<PlayerAction, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
};

/** The dealer's up-card the way the chart columns read it: 2–10 or "A". */
export function dealerUpLabel(rank: Rank): string {
  return rank === 'A' ? 'A' : String(blackjackValue(rank));
}

/** "Hard 16 vs 10" — the situation a book play answers. */
export function situationLabel(cards: readonly Pick<Card, 'rank'>[], dealerUpRank: Rank): string {
  return `${handLabel(cards)} vs ${dealerUpLabel(dealerUpRank)}`;
}
