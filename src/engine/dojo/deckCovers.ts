import { CASINO_MAPS } from '../betting/casino';
import { DeckCover } from '../types';
import { FlashProgress, isFlashLevelDone } from './countFlash';
import { giftCover, rewardKey } from './rewards';

/**
 * Which casinos have earned which Modern card back. The player picks one
 * style for the whole app; each casino deals it in its own colours once it
 * has earned the style, and deals `d` until then.
 *
 *   d  Counter — every casino, from the start
 *   e  Ivory   — the casino's gift (after level 1), once claimed
 *   f  Onyx    — clearing the casino's level 4
 */
export type DeckCoverUnlock =
  | { readonly kind: 'default' }
  | { readonly kind: 'gift' }
  | { readonly kind: 'level'; readonly level: number };

export const DECK_COVER_UNLOCK: Readonly<Record<DeckCover, DeckCoverUnlock>> = {
  d: { kind: 'default' },
  e: { kind: 'gift' },
  f: { kind: 'level', level: 4 },
};

/** The style's name, for pickers and the gift pop-up. */
export const DECK_COVER_NAMES: Readonly<Record<DeckCover, string>> = {
  d: 'Counter',
  e: 'Ivory',
  f: 'Onyx',
};

export function isDeckCoverEarned(
  progress: FlashProgress,
  opened: ReadonlySet<string>,
  mapId: number,
  cover: DeckCover,
): boolean {
  const unlock = DECK_COVER_UNLOCK[cover];
  switch (unlock.kind) {
    case 'default':
      return true;
    case 'gift':
      return giftCover(mapId) === cover && opened.has(rewardKey(mapId, 1));
    case 'level':
      return isFlashLevelDone(progress, mapId, unlock.level);
  }
}

/** How many of the six casinos have earned the cover. */
export function deckCoverEarnedCount(
  progress: FlashProgress,
  opened: ReadonlySet<string>,
  cover: DeckCover,
): number {
  return CASINO_MAPS.filter((map) => isDeckCoverEarned(progress, opened, map.id, cover)).length;
}

/** The cover a casino actually deals: the pick if it has earned it, else `d`. */
export function effectiveDeckCover(
  progress: FlashProgress,
  opened: ReadonlySet<string>,
  mapId: number,
  chosen: DeckCover,
): DeckCover {
  return isDeckCoverEarned(progress, opened, mapId, chosen) ? chosen : 'd';
}
