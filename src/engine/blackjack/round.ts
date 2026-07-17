import { Card } from '../cards/card';
import { draw, Shoe } from '../shoe/shoe';
import {
  addCard,
  createDealerHand,
  createPlayerHand,
  DealerHand,
  PlayerHand,
} from '../hand/hand';
import { handValue, isBust, isNaturalBlackjack, isTwentyOne } from '../hand/evaluate';
import { canDouble, canSplit, dealerShouldHit, PlayerAction } from './rules';

/**
 * Round controller: owns hands, split ordering, and turn advancement for one
 * blackjack round. Phase progression (betting → dealing → …) is owned by the
 * state machine; stores drive both together in later milestones.
 *
 * Counting integration: every card that becomes visible on the table is
 * reported through a `cardBecameVisible` event. The Hi-Lo counter consumes
 * these events — never animation timing. The dealer hole card only produces an
 * event when revealed during the dealer turn.
 */

export interface RoundState {
  /** Index 0 is the RIGHT hand, which plays first after a split (REBUILD_SPEC §10.3). */
  readonly playerHands: readonly PlayerHand[];
  readonly dealerHand: DealerHand;
  /** Index into playerHands, or null when the player turn is complete. */
  readonly activeHandIndex: number | null;
  readonly splitUsed: boolean;
  readonly baseBet: number;
}

export type RoundEventSource = 'deal' | 'hit' | 'double' | 'split' | 'dealerDraw' | 'holeReveal';

export type RoundEvent =
  | { readonly type: 'cardBecameVisible'; readonly card: Card; readonly source: RoundEventSource }
  | { readonly type: 'handAdvanced'; readonly toHandIndex: number }
  | { readonly type: 'playerTurnComplete' };

export interface RoundStep {
  readonly round: RoundState;
  readonly shoe: Shoe;
  readonly events: readonly RoundEvent[];
}

export class IllegalActionError extends Error {
  constructor(
    readonly action: PlayerAction,
    reason: string,
  ) {
    super(`Illegal action "${action}": ${reason}`);
    this.name = 'IllegalActionError';
  }
}

/**
 * Initial deal order (REBUILD_SPEC §4):
 * player card → dealer hole card (face down) → player card → dealer upcard (face up).
 */
export function startRound(baseBet: number, shoe: Shoe, handId = 'hand-0'): RoundStep {
  const p1 = draw(shoe, 'faceUp');
  const hole = draw(p1.shoe, 'faceDown');
  const p2 = draw(hole.shoe, 'faceUp');
  const up = draw(p2.shoe, 'faceUp');

  let playerHand = createPlayerHand(handId, baseBet);
  playerHand = addCard(playerHand, p1.card);
  playerHand = addCard(playerHand, p2.card);

  let dealerHand = createDealerHand();
  dealerHand = addCard(dealerHand, hole.card);
  dealerHand = addCard(dealerHand, up.card);

  const events: RoundEvent[] = [
    { type: 'cardBecameVisible', card: p1.card, source: 'deal' },
    { type: 'cardBecameVisible', card: p2.card, source: 'deal' },
    { type: 'cardBecameVisible', card: up.card, source: 'deal' },
  ];

  // Natural blackjack keeps the hand out of the player turn entirely.
  if (isNaturalBlackjack(playerHand)) {
    playerHand = { ...playerHand, status: 'stood' };
  }

  const round: RoundState = {
    playerHands: [playerHand],
    dealerHand,
    activeHandIndex: playerHand.status === 'active' ? 0 : null,
    splitUsed: false,
    baseBet,
  };

  if (round.activeHandIndex === null) {
    events.push({ type: 'playerTurnComplete' });
  }

  return { round, shoe: up.shoe, events };
}

export function activeHand(round: RoundState): PlayerHand | null {
  return round.activeHandIndex === null ? null : round.playerHands[round.activeHandIndex];
}

export function isPlayerTurnComplete(round: RoundState): boolean {
  return round.activeHandIndex === null;
}

export function allPlayerHandsBusted(round: RoundState): boolean {
  return round.playerHands.every((hand) => hand.status === 'busted');
}

export function playerHasNatural(round: RoundState): boolean {
  return round.playerHands.some((hand) => isNaturalBlackjack(hand));
}

function replaceHand(
  hands: readonly PlayerHand[],
  index: number,
  hand: PlayerHand,
): readonly PlayerHand[] {
  return hands.map((existing, i) => (i === index ? hand : existing));
}

/**
 * Moves the turn to the next 'active' hand (right hand first, then left),
 * or completes the player turn when none remain.
 */
function advanceTurn(round: RoundState, events: RoundEvent[]): RoundState {
  const nextIndex = round.playerHands.findIndex((hand) => hand.status === 'active');
  if (nextIndex === -1) {
    events.push({ type: 'playerTurnComplete' });
    return { ...round, activeHandIndex: null };
  }
  if (nextIndex !== round.activeHandIndex) {
    events.push({ type: 'handAdvanced', toHandIndex: nextIndex });
  }
  return { ...round, activeHandIndex: nextIndex };
}

/** A hand that reaches exactly 21 auto-stands and the turn advances (REBUILD_SPEC §10.3). */
function settleAfterCard(hand: PlayerHand, forceStand: boolean): PlayerHand {
  if (isBust(hand)) {
    return { ...hand, status: 'busted' };
  }
  if (forceStand || isTwentyOne(hand)) {
    return { ...hand, status: 'stood' };
  }
  return hand;
}

/**
 * Applies a player action to the active hand. Bankroll affordability for
 * double/split must be validated by the caller with the betting helpers —
 * this controller enforces the table rules only.
 */
export function applyPlayerAction(round: RoundState, shoe: Shoe, action: PlayerAction): RoundStep {
  const index = round.activeHandIndex;
  const hand = activeHand(round);
  if (index === null || hand === null) {
    throw new IllegalActionError(action, 'the player turn is already complete');
  }

  const events: RoundEvent[] = [];

  switch (action) {
    case 'hit': {
      const result = draw(shoe, 'faceUp');
      events.push({ type: 'cardBecameVisible', card: result.card, source: 'hit' });
      const nextHand = settleAfterCard(addCard(hand, result.card), false);
      let next: RoundState = { ...round, playerHands: replaceHand(round.playerHands, index, nextHand) };
      if (nextHand.status !== 'active') {
        next = advanceTurn(next, events);
      }
      return { round: next, shoe: result.shoe, events };
    }

    case 'stand': {
      const nextHand: PlayerHand = { ...hand, status: 'stood' };
      let next: RoundState = { ...round, playerHands: replaceHand(round.playerHands, index, nextHand) };
      next = advanceTurn(next, events);
      return { round: next, shoe, events };
    }

    case 'double': {
      if (!canDouble(hand)) {
        throw new IllegalActionError(action, 'double requires exactly two cards on an active hand');
      }
      const result = draw(shoe, 'faceUp');
      events.push({ type: 'cardBecameVisible', card: result.card, source: 'double' });
      const doubled: PlayerHand = { ...hand, bet: hand.bet * 2, isDoubled: true };
      const nextHand = settleAfterCard(addCard(doubled, result.card), true);
      let next: RoundState = { ...round, playerHands: replaceHand(round.playerHands, index, nextHand) };
      next = advanceTurn(next, events);
      return { round: next, shoe: result.shoe, events };
    }

    case 'split': {
      if (!canSplit(hand, round.splitUsed)) {
        throw new IllegalActionError(
          action,
          'split requires two equal-value cards and only one split per round',
        );
      }
      // Right hand (index 0, plays first) keeps the first card; left hand takes
      // the second. Each split hand receives one face-up follow-up card,
      // right hand first (REBUILD_SPEC §4).
      const rightFollowUp = draw(shoe, 'faceUp');
      const leftFollowUp = draw(rightFollowUp.shoe, 'faceUp');
      events.push({ type: 'cardBecameVisible', card: rightFollowUp.card, source: 'split' });
      events.push({ type: 'cardBecameVisible', card: leftFollowUp.card, source: 'split' });

      let rightHand: PlayerHand = {
        ...createPlayerHand(`${hand.id}-right`, hand.bet, [hand.cards[0]]),
        isFromSplit: true,
      };
      rightHand = settleAfterCard(addCard(rightHand, rightFollowUp.card), false);

      let leftHand: PlayerHand = {
        ...createPlayerHand(`${hand.id}-left`, hand.bet, [hand.cards[1]]),
        isFromSplit: true,
      };
      leftHand = settleAfterCard(addCard(leftHand, leftFollowUp.card), false);

      let next: RoundState = {
        ...round,
        playerHands: [rightHand, leftHand],
        splitUsed: true,
        activeHandIndex: 0,
      };
      next = advanceTurn(next, events);
      return { round: next, shoe: leftFollowUp.shoe, events };
    }
  }
}

/**
 * Dealer turn: the hole card is revealed (entering the visible count NOW), then
 * the dealer draws to 17, standing on soft 17. If every player hand busted, the
 * dealer only reveals the hole card and draws nothing (REBUILD_SPEC §10.4).
 */
export function playDealerTurn(round: RoundState, shoe: Shoe): RoundStep {
  const events: RoundEvent[] = [];

  const holeCard = { ...round.dealerHand.cards[0], visibility: 'faceUp' as const };
  let dealerHand: DealerHand = {
    ...round.dealerHand,
    cards: [holeCard, ...round.dealerHand.cards.slice(1)],
    holeRevealed: true,
  };
  events.push({ type: 'cardBecameVisible', card: holeCard, source: 'holeReveal' });

  let currentShoe = shoe;
  if (!allPlayerHandsBusted(round)) {
    while (dealerShouldHit(dealerHand)) {
      const result = draw(currentShoe, 'faceUp');
      currentShoe = result.shoe;
      dealerHand = addCard(dealerHand, result.card);
      events.push({ type: 'cardBecameVisible', card: result.card, source: 'dealerDraw' });
    }
  }

  return { round: { ...round, dealerHand }, shoe: currentShoe, events };
}

export function dealerTotal(round: RoundState): number {
  return handValue(round.dealerHand).total;
}
