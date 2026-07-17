import { Card } from '../cards/card';

export type PlayerHandStatus = 'active' | 'stood' | 'busted';

export interface Hand {
  readonly cards: readonly Card[];
}

export interface PlayerHand extends Hand {
  readonly id: string;
  /** Chips wagered on this hand (already doubled if `isDoubled`). */
  readonly bet: number;
  readonly isDoubled: boolean;
  readonly isFromSplit: boolean;
  readonly status: PlayerHandStatus;
}

export interface DealerHand extends Hand {
  /** The hole card (index 0) stays face down until the dealer turn reveal. */
  readonly holeRevealed: boolean;
}

export function createPlayerHand(id: string, bet: number, cards: readonly Card[] = []): PlayerHand {
  return { id, bet, cards, isDoubled: false, isFromSplit: false, status: 'active' };
}

export function createDealerHand(cards: readonly Card[] = []): DealerHand {
  return { cards, holeRevealed: false };
}

export function addCard<H extends Hand>(hand: H, card: Card): H {
  return { ...hand, cards: [...hand.cards, card] };
}
