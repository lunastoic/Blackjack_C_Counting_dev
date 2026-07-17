import { RoundState } from '../../engine/blackjack/round';
import { dealerHandOf, playerHandOf, riggedShoe } from '../../engine/testing/fixtures';
import { drawMany } from '../../engine/shoe/shoe';
import { INITIAL_DEAL_CARD_COUNT } from '../../utils/dealSequence';
import {
  cardsOnTable,
  pileLayerCount,
  shoeFillRatio,
  visibleDiscardCount,
  visibleShoeCount,
} from '../../utils/cardPiles';

function minimalRound(): RoundState {
  return {
    playerHands: [playerHandOf(['5', '6'])],
    dealerHand: dealerHandOf('10', '9'),
    activeHandIndex: null,
    splitUsed: false,
    baseBet: 10,
  };
}

describe('card pile helpers', () => {
  it('counts cards on the table', () => {
    expect(cardsOnTable(null)).toBe(0);
    expect(cardsOnTable(minimalRound())).toBe(4);
  });

  it('syncs shoe count with progressive opening deal', () => {
    const shoe = riggedShoe(
      Array.from({ length: 52 }, (_, i) => ({ id: `c-${i}` } as never)),
      1,
    );
    expect(visibleShoeCount(shoe, 'betting', 0, 0)).toBe(52);
    expect(visibleShoeCount(shoe, 'dealing', 0, 0)).toBe(
      52 + INITIAL_DEAL_CARD_COUNT,
    );
    expect(visibleShoeCount(shoe, 'dealing', 2, 0)).toBe(
      52 + (INITIAL_DEAL_CARD_COUNT - 2),
    );
    expect(visibleShoeCount(shoe, 'dealing', INITIAL_DEAL_CARD_COUNT, 0)).toBe(52);
  });

  it('includes pending hole reveals in the shoe stack', () => {
    const shoe = riggedShoe(Array.from({ length: 10 }, (_, i) => ({ id: `c-${i}` } as never)));
    expect(visibleShoeCount(shoe, 'dealerTurn', 4, 2)).toBe(12);
  });

  it('tracks discard as dealt minus on-table, growing during collection', () => {
    let shoe = riggedShoe(Array.from({ length: 20 }, (_, i) => ({ id: `c-${i}` } as never)));
    const round = minimalRound();
    const { shoe: dealtShoe } = drawMany(shoe, 4, 'faceUp');
    shoe = dealtShoe;

    expect(visibleDiscardCount(shoe, round, 'playerTurn')).toBe(0);
    expect(visibleDiscardCount(shoe, null, 'betting')).toBe(4);

    expect(visibleDiscardCount(shoe, round, 'collecting')).toBe(4);
    expect(visibleDiscardCount(shoe, null, 'collecting')).toBe(4);
  });

  it('keeps pending dealer draws out of the discard pile', () => {
    let shoe = riggedShoe(Array.from({ length: 20 }, (_, i) => ({ id: `c-${i}` } as never)));
    const round = minimalRound(); // 4 cards on table
    const { shoe: afterDeal } = drawMany(shoe, 4, 'faceUp');
    // Engine already drew 2 more dealer hits into the shoe, not yet on the felt.
    const { shoe: afterPending } = drawMany(afterDeal, 2, 'faceUp');
    shoe = afterPending;

    expect(visibleDiscardCount(shoe, round, 'dealerTurn', 0)).toBe(2);
    expect(visibleDiscardCount(shoe, round, 'dealerTurn', 2)).toBe(0);
  });

  it('maps card counts to capped stack depth', () => {
    expect(pileLayerCount(0, 312)).toBe(0);
    expect(pileLayerCount(1, 312)).toBe(1);
    expect(pileLayerCount(312, 312)).toBe(18);
    expect(pileLayerCount(156, 312)).toBe(9);
    expect(pileLayerCount(50, 0)).toBe(18);
  });

  it('scales the single shoe asset as cards are dealt', () => {
    expect(shoeFillRatio(0, 312)).toBe(0);
    expect(shoeFillRatio(312, 312)).toBe(1);
    expect(shoeFillRatio(156, 312)).toBeCloseTo(0.5, 2);
    expect(shoeFillRatio(10, 312)).toBe(0.38);
  });
});
