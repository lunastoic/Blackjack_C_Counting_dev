import { recommendForHand } from '../../engine/strategy/recommend';
import type { PlayerAction } from '../../engine/blackjack/rules';
import { activeHand } from '../../engine/blackjack/round';
import { expectedBet, expectedIndexPlay, expectedInsurance } from '../../engine/dojo';
import { cardsRemaining } from '../../engine/shoe/shoe';
import { useShoeRunStore } from '../../stores/shoeRunStore';

/**
 * Plays a boss the way a perfect counter would: every check right, the bet
 * the ramp (and the pit boss) allows, insurance at +3, the index plays, and
 * a stand on every other hand. Returns once the run is done.
 */
export function playBossPerfectly(mapId: number, level: number): void {
  const boss = useShoeRunStore.getState;
  boss().load(mapId, level);
  boss().begin();
  let guard = 0;
  while (boss().status !== 'done' && guard++ < 1000) {
    const state = boss();
    const spec = state.spec!;
    const left = state.shoe ? cardsRemaining(state.shoe) : 0;
    switch (state.status) {
      case 'question':
        state.answer(state.question!.correct);
        break;
      case 'bet':
        state.placeBet(expectedBet(state.runningCount, left, state.hands > 0 ? state.lastUnits : 8, spec.heat));
        break;
      case 'insurance':
        state.decideInsurance(expectedInsurance(state.runningCount, left));
        break;
      case 'play': {
        const round = state.round!;
        const hand = activeHand(round)!;
        const index =
          spec.indexPlays && hand.cards.length === 2 && round.playerHands.length === 1
            ? expectedIndexPlay(hand.cards, round.dealerHand.cards[1].rank, state.runningCount, left, {
                canDouble: state.canAct('double'),
                canSplit: state.canAct('split'),
              })
            : null;
        // Graded tables want the book play; the rest only grade count plays.
        let book: PlayerAction = 'stand';
        if (spec.gradeMoves) {
          const recommendation = recommendForHand(
            hand,
            round.dealerHand.cards[1].rank,
            { canDouble: state.canAct('double'), canSplit: state.canAct('split') },
            spec.deckCount,
          );
          book = state.canAct(recommendation.preferredAction)
            ? recommendation.preferredAction
            : (recommendation.fallbackAction ?? 'hit');
        }
        state.act(index ?? book);
        break;
      }
      case 'result':
        state.nextHand();
        break;
      default:
        throw new Error(`boss stuck at ${state.status}`);
    }
  }
}
