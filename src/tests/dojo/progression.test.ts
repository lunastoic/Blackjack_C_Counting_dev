import {
  isDojoGraduate,
  isLessonUnlocked,
  rankForXp,
  xpToNextRank,
} from '../../engine/dojo/progression';

describe('dojo progression', () => {
  it('starts at white belt', () => {
    expect(rankForXp(0).title).toBe('White Belt');
  });

  it('advances through ranks by XP', () => {
    expect(rankForXp(20).title).toBe('Yellow Belt');
    expect(rankForXp(60).title).toBe('Orange Belt');
    expect(rankForXp(300).title).toBe('Black Belt');
  });

  it('reports XP to next rank', () => {
    expect(xpToNextRank(0)).toBe(20);
    expect(xpToNextRank(300)).toBe(0);
  });

  it('unlocks lessons sequentially', () => {
    const completed = new Set<'hi-lo-values'>(['hi-lo-values']);
    expect(isLessonUnlocked('running-count', completed, 0)).toBe(true);
    expect(isLessonUnlocked('hole-card-rule', completed, 1)).toBe(false);
  });

  it('detects graduation', () => {
    const completed = new Set<
      | 'hi-lo-values'
      | 'running-count'
      | 'hole-card-rule'
      | 'true-count'
      | 'count-and-play'
      | 'betting-by-count'
    >([
      'hi-lo-values',
      'running-count',
      'hole-card-rule',
      'true-count',
      'count-and-play',
      'betting-by-count',
    ]);
    expect(isDojoGraduate(completed)).toBe(true);
  });
});
