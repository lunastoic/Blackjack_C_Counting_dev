import { DealerHand, PlayerHand } from '../hand/hand';
import { handValue, isBust, isNaturalBlackjack } from '../hand/evaluate';
import { RoundState } from './round';

/**
 * Per-hand outcome. 'blackjack' means a NATURAL blackjack (two-card 21 on a
 * non-split hand) which pays 3:2; a split-hand 21 resolves as a plain 'win'.
 */
export type HandResult = 'blackjack' | 'win' | 'push' | 'loss';

export interface HandResolution {
  readonly handId: string;
  readonly result: HandResult;
  readonly bet: number;
  readonly wasDoubled: boolean;
  readonly wasSplitHand: boolean;
  readonly playerBusted: boolean;
}

export interface RoundResolution {
  readonly hands: readonly HandResolution[];
  readonly dealerBusted: boolean;
  readonly dealerHadNatural: boolean;
}

/**
 * Resolution rules:
 * - Player bust always loses (even if the dealer later busts).
 * - Both naturals push; player natural beats any non-natural 21; a dealer
 *   natural beats every non-natural hand. (No dealer peek / no insurance, so a
 *   dealer natural is discovered at hole reveal.)
 * - Otherwise: dealer bust wins for the player, then higher total wins.
 */
export function resolveHand(playerHand: PlayerHand, dealerHand: DealerHand): HandResult {
  if (isBust(playerHand)) {
    return 'loss';
  }

  const playerNatural = isNaturalBlackjack(playerHand);
  const dealerNatural = isNaturalBlackjack(dealerHand);
  if (playerNatural && dealerNatural) {
    return 'push';
  }
  if (playerNatural) {
    return 'blackjack';
  }
  if (dealerNatural) {
    return 'loss';
  }

  const playerTotal = handValue(playerHand).total;
  const dealerTotal = handValue(dealerHand).total;
  if (dealerTotal > 21 || playerTotal > dealerTotal) {
    return 'win';
  }
  if (playerTotal === dealerTotal) {
    return 'push';
  }
  return 'loss';
}

export function resolveRound(round: RoundState): RoundResolution {
  return {
    hands: round.playerHands.map((hand) => ({
      handId: hand.id,
      result: resolveHand(hand, round.dealerHand),
      bet: hand.bet,
      wasDoubled: hand.isDoubled,
      wasSplitHand: hand.isFromSplit,
      playerBusted: hand.status === 'busted',
    })),
    dealerBusted: isBust(round.dealerHand),
    dealerHadNatural: isNaturalBlackjack(round.dealerHand),
  };
}
