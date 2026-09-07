import { levelTutorial, MAX_TUTORIAL_SLIDES, TRAINING_MAPS } from '../../engine/dojo';

const allLevels = TRAINING_MAPS.flatMap((map) => map.levels.map((spec) => ({ mapId: map.mapId, spec })));

/** Long enough for two short sentences, short enough to rule out a run-on. */
const MAX_BODY_CHARS = 120;
const MAX_TITLE_CHARS = 36;

describe('level tutorials', () => {
  it('gives every level one to four slides', () => {
    for (const { mapId, spec } of allLevels) {
      const slides = levelTutorial(mapId, spec.level);
      expect(slides.length).toBeGreaterThanOrEqual(1);
      expect(slides.length).toBeLessThanOrEqual(MAX_TUTORIAL_SLIDES);
    }
  });

  it('keeps every slide short', () => {
    for (const { mapId, spec } of allLevels) {
      for (const slide of levelTutorial(mapId, spec.level)) {
        expect(slide.title.trim().length).toBeGreaterThan(0);
        expect(slide.title.length).toBeLessThanOrEqual(MAX_TITLE_CHARS);
        expect(slide.body.trim().length).toBeGreaterThan(0);
        expect(slide.body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
        // At most three sentences per slide.
        expect(slide.body.split(/[.!?](\s|$)/).filter((part) => part.trim()).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('returns nothing for a level that is not on the ladder', () => {
    expect(levelTutorial(1, 7)).toEqual([]);
    expect(levelTutorial(9, 1)).toEqual([]);
  });
});
