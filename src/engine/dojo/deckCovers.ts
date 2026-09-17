import { CASINO_MAPS } from '../betting/casino';
import { DeckCover } from '../types';
import { FlashProgress, isFlashLevelDone } from './countFlash';

/**
 * Which casinos have earned which Modern card back. The player picks one
 * style for the whole app; each casino deals it in its own colours once its
 * flash ladder has cleared the style's level, and deals `d` until then.
 */

/** The flash level a casino must clear to wear each cover; 0 = from the start. */
export const DECK_COVER_UNLOCK_LEVEL: Readonly<Record<DeckCover, number>> = {
  d: 0,
  e: 2,
  f: 4,
};

export function isDeckCoverEarned(
  progress: FlashProgress,
  mapId: number,
  cover: DeckCover,
): boolean {
  const level = DECK_COVER_UNLOCK_LEVEL[cover];
  return level === 0 || isFlashLevelDone(progress, mapId, level);
}

/** How many of the six casinos have earned the cover. */
export function deckCoverEarnedCount(progress: FlashProgress, cover: DeckCover): number {
  return CASINO_MAPS.filter((map) => isDeckCoverEarned(progress, map.id, cover)).length;
}

/** The cover a casino actually deals: the pick if it has earned it, else `d`. */
export function effectiveDeckCover(
  progress: FlashProgress,
  mapId: number,
  chosen: DeckCover,
): DeckCover {
  return isDeckCoverEarned(progress, mapId, chosen) ? chosen : 'd';
}
