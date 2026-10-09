import { CASINO_MAPS } from '../../engine/betting/casino';
import {
  CLEAR_STARS,
  DECK_COVER_NAMES,
  DECK_COVER_UNLOCK,
  deckCoverEarnedCount,
  effectiveDeckCover,
  flashLevelKey,
  FlashProgress,
  giftCover,
  isDeckCoverEarned,
  rewardKey,
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

const NONE: ReadonlySet<string> = new Set();
/** Gifts claimed on these casinos. */
function gifts(...mapIds: number[]): ReadonlySet<string> {
  return new Set(mapIds.map((mapId) => rewardKey(mapId, 1)));
}

describe('deck covers — what a casino has earned', () => {
  it('Counter is on every casino from the start', () => {
    for (const map of CASINO_MAPS) {
      expect(isDeckCoverEarned({}, NONE, map.id, 'd')).toBe(true);
    }
    expect(deckCoverEarnedCount({}, NONE, 'd')).toBe(CASINO_MAPS.length);
  });

  it('names the styles and how each is earned', () => {
    expect(DECK_COVER_NAMES).toEqual({ d: 'Counter', e: 'Ivory', f: 'Onyx' });
    expect(DECK_COVER_UNLOCK).toEqual({
      d: { kind: 'default' },
      e: { kind: 'gift' },
      f: { kind: 'level', level: 4 },
    });
  });

  it('every casino’s gift holds the Ivory card back', () => {
    for (const map of CASINO_MAPS) {
      expect(giftCover(map.id)).toBe('e');
    }
  });

  it('Ivory comes from claiming the casino’s gift, not from clearing levels', () => {
    expect(isDeckCoverEarned(cleared(1, 6), NONE, 1, 'e')).toBe(false);
    expect(isDeckCoverEarned({}, gifts(1), 1, 'e')).toBe(true);
    // The money bag is not the gift.
    expect(isDeckCoverEarned({}, new Set([rewardKey(1, 2)]), 1, 'e')).toBe(false);
  });

  it('Onyx needs level 4 cleared — one star banked is not enough', () => {
    expect(isDeckCoverEarned(cleared(1, 3), NONE, 1, 'f')).toBe(false);
    expect(isDeckCoverEarned(cleared(1, 4), NONE, 1, 'f')).toBe(true);
    expect(isDeckCoverEarned({ [flashLevelKey(3, 4)]: 1 }, NONE, 3, 'f')).toBe(false);
  });

  it('is earned per casino', () => {
    const progress = { ...cleared(1, 4), ...cleared(2, 2) };
    expect(isDeckCoverEarned(progress, gifts(1, 2), 2, 'e')).toBe(true);
    expect(isDeckCoverEarned(progress, gifts(1, 2), 3, 'e')).toBe(false);
    expect(deckCoverEarnedCount(progress, gifts(1, 2), 'e')).toBe(2);
    expect(deckCoverEarnedCount(progress, gifts(1, 2), 'f')).toBe(1);
  });
});

describe('deck covers — what a casino deals', () => {
  it('deals the pick once earned and Counter until then', () => {
    expect(effectiveDeckCover({}, gifts(1), 1, 'e')).toBe('e');
    expect(effectiveDeckCover({}, gifts(1), 1, 'f')).toBe('d');
    expect(effectiveDeckCover({}, gifts(1), 2, 'e')).toBe('d');
  });

  it('always deals Counter when Counter is the pick', () => {
    for (const map of CASINO_MAPS) {
      expect(effectiveDeckCover({}, NONE, map.id, 'd')).toBe('d');
    }
  });

  it('never deals something outside the three styles', () => {
    for (const cover of DECK_COVERS) {
      expect(DECK_COVERS).toContain(effectiveDeckCover(cleared(1, 6), gifts(1), 1, cover));
    }
  });
});
