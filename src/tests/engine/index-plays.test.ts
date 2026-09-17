import { Rank } from '../../engine/cards/card';
import { DECISION, IndexPlayLevel, makeIndexPlayItem } from '../../engine/dojo/training';
import {
  INDEX_PLAYS,
  indexAction,
  indexPlayFor,
  shouldTakeInsurance,
  TOP_INDEX_PLAY_IDS,
} from '../../engine/strategy/indexPlays';
import { cardsOf, seededRng } from '../../engine/testing/fixtures';

const ALL = { canDouble: true, canSplit: true };

function spot(ranks: Rank[], up: Rank) {
  return indexPlayFor(cardsOf(...ranks), up);
}

describe('index plays', () => {
  it('takes insurance at +3 and up', () => {
    expect(shouldTakeInsurance(2.9)).toBe(false);
    expect(shouldTakeInsurance(3)).toBe(true);
    expect(shouldTakeInsurance(-4)).toBe(false);
  });

  it('finds the spot by hard total and dealer card, tens as a pair', () => {
    expect(spot(['10', '6'], 'K')?.id).toBe('16v10');
    expect(spot(['9', '7'], '10')?.id).toBe('16v10');
    expect(spot(['K', 'Q'], '6')?.id).toBe('TTv6');
    expect(spot(['5', '6'], 'A')?.id).toBe('11vA');
    // Soft 16 and a three-card 16 vs 7 are not index spots.
    expect(spot(['A', '5'], '10')).toBeNull();
    expect(spot(['10', '6'], '7')).toBeNull();
  });

  it('deviates at the index or higher, plays below it otherwise', () => {
    const sixteen = INDEX_PLAYS.find((play) => play.id === '16v10')!;
    expect(indexAction(sixteen, -1, ALL)).toBe('hit');
    expect(indexAction(sixteen, 0, ALL)).toBe('stand');
    const twelveFour = INDEX_PLAYS.find((play) => play.id === '12v4')!;
    expect(indexAction(twelveFour, -1, ALL)).toBe('hit');
    expect(indexAction(twelveFour, 0, ALL)).toBe('stand');
    const tensFive = INDEX_PLAYS.find((play) => play.id === 'TTv5')!;
    expect(indexAction(tensFive, 5, ALL)).toBe('split');
    expect(indexAction(tensFive, 5, { canDouble: true, canSplit: false })).toBe('stand');
    const tenTen = INDEX_PLAYS.find((play) => play.id === '10v10')!;
    expect(indexAction(tenTen, 6, { canDouble: false, canSplit: true })).toBe('hit');
  });

  it('keeps six top plays that exist on the list', () => {
    expect(TOP_INDEX_PLAY_IDS).toHaveLength(6);
    for (const id of TOP_INDEX_PLAY_IDS) {
      expect(INDEX_PLAYS.some((play) => play.id === id)).toBe(true);
    }
  });
});

describe('index-play drill items', () => {
  const base = { level: 1, title: 't', brief: 'b', speed: 'normal', streakTarget: 21, strikes: 1 } as const;

  it('insurance items ask take-or-decline on an Ace, right at +3', () => {
    const spec: IndexPlayLevel = { ...base, mode: 'indexPlay', plays: 'insurance', showTrueCount: false };
    const seen = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) {
      const item = makeIndexPlayItem(spec, seededRng(seed));
      expect(item.question).toBe('insurance');
      expect(item.dealerUp.rank).toBe('A');
      expect(item.correct).toBe(item.trueCount >= 3 ? DECISION.insure : DECISION.noInsurance);
      expect(item.choices).toContain(item.correct);
      seen.add(item.correct);
    }
    expect(seen.size).toBe(2);
  });

  it('play items match the index play for their hand, count and dealer card', () => {
    const spec: IndexPlayLevel = { ...base, mode: 'indexPlay', plays: 'all', showTrueCount: true };
    const codes = { hit: DECISION.hit, stand: DECISION.stand, double: DECISION.double, split: DECISION.split };
    for (let seed = 1; seed <= 120; seed++) {
      const item = makeIndexPlayItem(spec, seededRng(seed));
      if (item.question === 'insurance') {
        continue;
      }
      const play = indexPlayFor(item.playerCards, item.dealerUp.rank);
      expect(play).not.toBeNull();
      expect(item.correct).toBe(codes[indexAction(play!, item.trueCount, ALL)]);
    }
  });
});
