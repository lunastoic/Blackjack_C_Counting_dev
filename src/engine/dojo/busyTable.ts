import { Card, hiLoValue } from '../cards/card';
import { createShoe, DeckCount, draw, Shoe } from '../shoe/shoe';
import { defaultRng, Rng } from '../shoe/rng';

/**
 * Busy Table — Kepler's level 2. A whole table is dealt face up from a fresh
 * shoe: the dealer's cards and every seat's hand, some seats with a hit. It
 * shows for a moment, flips face down, and the player types the count of
 * everything they saw.
 *
 * Pure TypeScript — no React / RN imports.
 */

export interface BusyTableDeal {
  /** The dealer's cards, both face up (sometimes a third: the dealer drew). */
  readonly dealer: readonly Card[];
  /** Each seat's hand, two or three cards. */
  readonly seats: readonly (readonly Card[])[];
  /** Hi-Lo sum of every card on the table — the answer. */
  readonly count: number;
}

/** Share of seats that took a hit. */
const SEAT_HIT_CHANCE = 0.4;
/** Share of tables where the dealer drew a third card. */
const DEALER_HIT_CHANCE = 0.3;

/** Every card the table shows, dealer first. */
export function busyTableCards(deal: BusyTableDeal): Card[] {
  return [...deal.dealer, ...deal.seats.flat()];
}

/** Hi-Lo sum of a set of cards. */
export function busyTableCount(cards: readonly Card[]): number {
  return cards.reduce((sum, card) => sum + hiLoValue(card.rank), 0);
}

/**
 * One table off a fresh `deckCount` shoe: `seats` hands of two cards (some
 * with a third) and the dealer's two (sometimes three), all face up.
 */
export function dealBusyTable(deckCount: DeckCount, seats: number, rng: Rng = defaultRng): BusyTableDeal {
  let shoe: Shoe = createShoe(deckCount, rng);
  const take = (): Card => {
    const result = draw(shoe, 'faceUp');
    shoe = result.shoe;
    return result.card;
  };

  const hands: Card[][] = Array.from({ length: seats }, () => [] as Card[]);
  const dealer: Card[] = [];
  // Deal round the table twice, like a dealer does: seats, then the dealer.
  for (let pass = 0; pass < 2; pass++) {
    for (const hand of hands) {
      hand.push(take());
    }
    dealer.push(take());
  }
  for (const hand of hands) {
    if (rng() < SEAT_HIT_CHANCE) {
      hand.push(take());
    }
  }
  if (rng() < DEALER_HIT_CHANCE) {
    dealer.push(take());
  }

  const count = busyTableCount([...dealer, ...hands.flat()]);
  return { dealer, seats: hands, count };
}
