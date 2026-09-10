import {
  ACTION_LABELS,
  dealerUpLabel,
  handLabel,
  situationLabel,
} from '../../engine/strategy/describe';
import { cardsOf } from '../../engine/testing/fixtures';

/** Plain words for a strategy situation, the way the chart reads it. */
describe('strategy situation labels', () => {
  it('names hard, soft and paired hands like the chart', () => {
    expect(handLabel(cardsOf('10', '6'))).toBe('Hard 16');
    expect(handLabel(cardsOf('A', '7'))).toBe('Soft 18');
    expect(handLabel(cardsOf('8', '8'))).toBe('Pair of 8s');
    expect(handLabel(cardsOf('A', 'A'))).toBe('Pair of aces');
    expect(handLabel(cardsOf('K', '10'))).toBe('Pair of tens');
    expect(handLabel(cardsOf('Q', 'J'))).toBe('Pair of tens');
  });

  it('a soft hand that busts its ace reads hard, and three cards are never a pair', () => {
    expect(handLabel(cardsOf('A', '7', '9'))).toBe('Hard 17');
    expect(handLabel(cardsOf('8', '8', '2'))).toBe('Hard 18');
    expect(handLabel(cardsOf('A', '2', '3'))).toBe('Soft 16');
  });

  it('reads the dealer up-card as a chart column', () => {
    expect(dealerUpLabel('A')).toBe('A');
    expect(dealerUpLabel('K')).toBe('10');
    expect(dealerUpLabel('7')).toBe('7');
    expect(situationLabel(cardsOf('10', '6'), 'K')).toBe('Hard 16 vs 10');
    expect(situationLabel(cardsOf('A', 'A'), 'A')).toBe('Pair of aces vs A');
  });

  it('has a label for every action', () => {
    expect(Object.keys(ACTION_LABELS).sort()).toEqual(['double', 'hit', 'split', 'stand']);
    expect(ACTION_LABELS.stand).toBe('Stand');
  });
});
