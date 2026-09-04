import { isFaceUp } from '../../engine/cards/card';
import {
  dealFlashAutoRound,
  FLASH_LEVELS_PER_MAP,
  flashLevelKey,
  isFlashLevel,
  isFlashLevelUnlocked,
  isMapFlashComplete,
  nextFlashLevel,
} from '../../engine/dojo';
import { evaluateCards } from '../../engine/hand/evaluate';
import { seededRng } from '../../engine/shoe/rng';
import { createShoe } from '../../engine/shoe/shoe';

describe('count training — level range', () => {
  it('rejects out-of-range levels', () => {
    expect(isFlashLevel(0)).toBe(false);
    expect(isFlashLevel(7)).toBe(false);
    expect(isFlashLevel(1.5)).toBe(false);
    expect(isFlashLevel(6)).toBe(true);
  });
});

describe('count training — autoplayed rounds (original blackjack count test)', () => {
  it('plays both hands to at least 17, hole face down, everything else up', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seededRng(seed);
      const shoe = createShoe(1, rng);
      const { shoe: next, round } = dealFlashAutoRound(shoe, rng);

      expect(round.player.length).toBeGreaterThanOrEqual(2);
      expect(round.dealer.length).toBeGreaterThanOrEqual(2);
      expect(evaluateCards(round.player).total).toBeGreaterThanOrEqual(17);
      expect(evaluateCards(round.dealer).total).toBeGreaterThanOrEqual(17);
      expect(round.player.every((card) => isFaceUp(card))).toBe(true);
      expect(isFaceUp(round.dealer[0])).toBe(false);
      expect(round.dealer.slice(1).every((card) => isFaceUp(card))).toBe(true);
      expect(next.drawnCount).toBe(round.player.length + round.dealer.length);
    }
  });

  it('renews a deck that is running low before dealing', () => {
    const rng = seededRng(9);
    let shoe = createShoe(1, rng);
    while (shoe.cards.length - shoe.drawnCount >= 16) {
      shoe = { ...shoe, drawnCount: shoe.drawnCount + 1 };
    }
    const { reshuffled, round } = dealFlashAutoRound(shoe, rng);
    expect(reshuffled).toBe(true);
    expect(round.player.length + round.dealer.length).toBeGreaterThanOrEqual(4);
  });
});

describe('count training — ladder progress', () => {
  it('opens level 1 only, then one level at a time', () => {
    expect(isFlashLevelUnlocked({}, 1, 1)).toBe(true);
    expect(isFlashLevelUnlocked({}, 1, 2)).toBe(false);
    const oneDone = { [flashLevelKey(1, 1)]: 3 };
    expect(isFlashLevelUnlocked(oneDone, 1, 2)).toBe(true);
    expect(isFlashLevelUnlocked(oneDone, 1, 3)).toBe(false);
    expect(isFlashLevelUnlocked(oneDone, 2, 2)).toBe(false); // other casino
    expect(isFlashLevelUnlocked(oneDone, 1, 9)).toBe(false);
  });

  it('reports the next level and completion', () => {
    const progress: Record<string, number> = {};
    expect(nextFlashLevel(progress, 1)).toBe(1);
    for (let level = 1; level <= FLASH_LEVELS_PER_MAP; level++) {
      progress[flashLevelKey(1, level)] = 2;
      expect(nextFlashLevel(progress, 1)).toBe(level === 6 ? null : level + 1);
    }
    expect(isMapFlashComplete(progress, 1)).toBe(true);
    expect(isMapFlashComplete(progress, 2)).toBe(false);
  });
});
