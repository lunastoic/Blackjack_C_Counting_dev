import { CASINO_MAPS } from '../../engine/betting/casino';
import {
  CLEAR_STARS,
  DECK_COVER_UNLOCK_LEVEL,
  deckCoverEarnedCount,
  effectiveDeckCover,
  flashLevelKey,
  FlashProgress,
  isDeckCoverEarned,
} from '../../engine/dojo';
import { DECK_COVERS } from '../../engine/types';

/** A ladder cleared through `level` on one casino. */
function cleared(mapId: number, level: number): FlashProgress {
  const progress: Record<string, number> = {};
  for (let l = 1; l <= level; l++) {
    progress[flashLevelKey(mapId, l)] = CLEAR_STARS;
  }
  return progress;
}

describe('deck covers — what a casino has earned', () => {
  it('D is on every casino from the start', () => {
    for (const map of CASINO_MAPS) {
      expect(isDeckCoverEarned({}, map.id, 'd')).toBe(true);
    }
    expect(deckCoverEarnedCount({}, 'd')).toBe(CASINO_MAPS.length);
  });

  it('E and F need level 2 and level 4 cleared', () => {
    expect(DECK_COVER_UNLOCK_LEVEL).toEqual({ d: 0, e: 2, f: 4 });
    expect(isDeckCoverEarned(cleared(1, 1), 1, 'e')).toBe(false);
    expect(isDeckCoverEarned(cleared(1, 2), 1, 'e')).toBe(true);
    expect(isDeckCoverEarned(cleared(1, 3), 1, 'f')).toBe(false);
    expect(isDeckCoverEarned(cleared(1, 4), 1, 'f')).toBe(true);
  });

  it('one star banked on the level does not earn the cover', () => {
    expect(isDeckCoverEarned({ [flashLevelKey(3, 2)]: 1 }, 3, 'e')).toBe(false);
  });

  it('is earned per casino', () => {
    const progress = { ...cleared(1, 4), ...cleared(2, 2) };
    expect(isDeckCoverEarned(progress, 2, 'e')).toBe(true);
    expect(isDeckCoverEarned(progress, 3, 'e')).toBe(false);
    expect(deckCoverEarnedCount(progress, 'e')).toBe(2);
    expect(deckCoverEarnedCount(progress, 'f')).toBe(1);
  });
});

describe('deck covers — what a casino deals', () => {
  it('deals the pick once earned and D until then', () => {
    const progress = cleared(1, 2);
    expect(effectiveDeckCover(progress, 1, 'e')).toBe('e');
    expect(effectiveDeckCover(progress, 1, 'f')).toBe('d');
    expect(effectiveDeckCover(progress, 2, 'e')).toBe('d');
  });

  it('always deals D when D is the pick', () => {
    for (const map of CASINO_MAPS) {
      expect(effectiveDeckCover({}, map.id, 'd')).toBe('d');
    }
  });

  it('never deals something outside the three styles', () => {
    for (const cover of DECK_COVERS) {
      expect(DECK_COVERS).toContain(effectiveDeckCover(cleared(1, 6), 1, cover));
    }
  });
});
