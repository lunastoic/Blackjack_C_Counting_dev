import {
  awardXp,
  CHIPS_PER_LEVEL_UP,
  INITIAL_PROGRESS,
  isMaxLevel,
  MAX_LEVEL,
  PlayerProgress,
  XP_AWARDS,
  xpForHandResult,
  XP_PER_LEVEL,
} from '../../engine/progression/progression';

describe('XP awards', () => {
  it('matches the spec: win 3, push 2, loss 1, quiz 3', () => {
    expect(xpForHandResult('win')).toBe(3);
    expect(xpForHandResult('blackjack')).toBe(3);
    expect(xpForHandResult('push')).toBe(2);
    expect(xpForHandResult('loss')).toBe(1);
    expect(XP_AWARDS.quizCorrect).toBe(3);
  });

  it('rejects negative or fractional XP', () => {
    expect(() => awardXp(INITIAL_PROGRESS, -1)).toThrow(RangeError);
    expect(() => awardXp(INITIAL_PROGRESS, 1.5)).toThrow(RangeError);
  });
});

describe('leveling', () => {
  it('accumulates XP within a level', () => {
    const result = awardXp(INITIAL_PROGRESS, 10);
    expect(result.newLevel).toBe(1);
    expect(result.newXp).toBe(10);
    expect(result.levelsGained).toBe(0);
    expect(result.chipReward).toBe(0);
  });

  it('levels up at 30 XP and grants 1000 chips', () => {
    const result = awardXp({ level: 1, xpIntoLevel: 28 }, 3);
    expect(result.previousLevel).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.newXp).toBe(1);
    expect(result.levelsGained).toBe(1);
    expect(result.chipReward).toBe(CHIPS_PER_LEVEL_UP);
  });

  it('supports multiple level-ups from one award', () => {
    const result = awardXp({ level: 1, xpIntoLevel: 0 }, XP_PER_LEVEL * 3 + 5);
    expect(result.newLevel).toBe(4);
    expect(result.newXp).toBe(5);
    expect(result.levelsGained).toBe(3);
    expect(result.chipReward).toBe(3000);
  });

  it('caps at level 25 and discards overflow XP', () => {
    const nearMax: PlayerProgress = { level: 24, xpIntoLevel: 29 };
    const result = awardXp(nearMax, 500);
    expect(result.newLevel).toBe(MAX_LEVEL);
    expect(result.levelsGained).toBe(1);
    expect(result.chipReward).toBe(1000);
    expect(result.newXp).toBe(0);
    expect(isMaxLevel(result.progress)).toBe(true);
  });

  it('awards nothing beyond level 25', () => {
    const maxed: PlayerProgress = { level: 25, xpIntoLevel: 0 };
    const result = awardXp(maxed, 300);
    expect(result.newLevel).toBe(25);
    expect(result.levelsGained).toBe(0);
    expect(result.chipReward).toBe(0);
    expect(result.newXp).toBe(0);
  });
});
