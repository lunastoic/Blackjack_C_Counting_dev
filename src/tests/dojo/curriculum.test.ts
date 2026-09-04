import {
  DOJO_LESSONS,
  HI_LO_GROUPS,
  lessonById,
  nextLessonId,
} from '../../engine/dojo/curriculum';

describe('dojo curriculum', () => {
  it('has six lessons in order', () => {
    expect(DOJO_LESSONS).toHaveLength(6);
    for (let i = 0; i < DOJO_LESSONS.length; i++) {
      expect(DOJO_LESSONS[i].order).toBe(i + 1);
    }
  });

  it('looks up lessons by id', () => {
    expect(lessonById('hi-lo-values')?.title).toBe('Hi-Lo Values');
    expect(lessonById('running-count')?.title).toBe('Running Count');
    expect(lessonById('betting-by-count')?.title).toBe('Bet by the Count');
  });

  it('returns the next incomplete lesson id', () => {
    const completed = new Set<'hi-lo-values'>(['hi-lo-values']);
    expect(nextLessonId(completed)).toBe('running-count');
  });

  it('returns null when all lessons are complete', () => {
    const completed = new Set(DOJO_LESSONS.map((l) => l.id));
    expect(nextLessonId(completed)).toBeNull();
  });

  it('groups ranks by Hi-Lo value', () => {
    expect(HI_LO_GROUPS[1].ranks).toEqual(['2', '3', '4', '5', '6']);
    expect(HI_LO_GROUPS[0].ranks).toEqual(['7', '8', '9']);
    expect(HI_LO_GROUPS[-1].ranks).toEqual(['A', '10', 'J', 'Q', 'K']);
  });
});
