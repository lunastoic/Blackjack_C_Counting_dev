import { Card } from '../cards/card';
import { evaluateCards } from '../hand/evaluate';
import { createShoe, draw, Shoe } from '../shoe/shoe';
import { defaultRng, Rng } from '../shoe/rng';

/**
 * Count training ladder — progress helpers and the original autoplayed
 * blackjack deal. The level content itself lives in `training.ts`; the
 * persisted progress map keeps the historical `flashLevels` name.
 *
 * Pure TypeScript — no React / RN imports (see architecture-guard test).
 */

export const FLASH_LEVELS_PER_MAP = 6;

/** Cards in one opening deal: player → dealer hole → player → dealer up. */
export const FLASH_CARDS_PER_ROUND = 4;

export function isFlashLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= FLASH_LEVELS_PER_MAP;
}

// ---------------------------------------------------------------------------
// Autoplayed blackjack hand (the original "Blackjack Count Test")
// ---------------------------------------------------------------------------

/** Both hands draw to at least this total, like the house dealer. */
export const FLASH_AUTOPLAY_STAND = 17;
/** Renew the deck before a round that might not have enough cards left. */
const AUTOPLAY_MIN_CARDS = 16;

export interface FlashAutoRound {
  /** Player's full hand, all face up, in draw order. */
  readonly player: readonly Card[];
  /** Dealer's full hand: [hole (face down), upcard, hits…]. */
  readonly dealer: readonly Card[];
}

/**
 * Deals a whole autoplayed hand: opening four (player, hole, player, upcard),
 * then the player draws to 17 or bust, then the dealer does the same. The
 * hole card is returned face down — the presentation flips it when the
 * dealer's turn comes.
 */
export function dealFlashAutoRound(
  shoe: Shoe,
  rng: Rng = defaultRng,
): { readonly shoe: Shoe; readonly round: FlashAutoRound; readonly reshuffled: boolean } {
  let current = shoe;
  let reshuffled = false;
  if (current.cards.length - current.drawnCount < AUTOPLAY_MIN_CARDS) {
    current = createShoe(current.deckCount, rng);
    reshuffled = true;
  }

  const take = (visibility: 'faceUp' | 'faceDown'): Card => {
    const result = draw(current, visibility);
    current = result.shoe;
    return result.card;
  };

  const player: Card[] = [take('faceUp')];
  const dealer: Card[] = [take('faceDown')];
  player.push(take('faceUp'));
  dealer.push(take('faceUp'));

  while (evaluateCards(player).total < FLASH_AUTOPLAY_STAND) {
    player.push(take('faceUp'));
  }
  while (evaluateCards(dealer).total < FLASH_AUTOPLAY_STAND) {
    dealer.push(take('faceUp'));
  }

  return { shoe: current, round: { player, dealer }, reshuffled };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** Best stars per level, keyed by `flashLevelKey(mapId, level)`. */
export type FlashProgress = Readonly<Record<string, number>>;

/**
 * Stars that clear a level: the second of three. One star is banked
 * progress (the next level stays shut); the third is the stretch.
 */
export const CLEAR_STARS = 2;

export function flashLevelKey(mapId: number, level: number): string {
  return `${mapId}:${level}`;
}

export function flashStars(progress: FlashProgress, mapId: number, level: number): number {
  return progress[flashLevelKey(mapId, level)] ?? 0;
}

export function isFlashLevelDone(progress: FlashProgress, mapId: number, level: number): boolean {
  return flashStars(progress, mapId, level) >= CLEAR_STARS;
}

/** Level 1 is always open; every other level needs the one before it cleared. */
export function isFlashLevelUnlocked(
  progress: FlashProgress,
  mapId: number,
  level: number,
): boolean {
  if (!isFlashLevel(level)) {
    return false;
  }
  return level === 1 || isFlashLevelDone(progress, mapId, level - 1);
}

/** First level not yet cleared, or null once the whole ladder is done. */
export function nextFlashLevel(progress: FlashProgress, mapId: number): number | null {
  for (let level = 1; level <= FLASH_LEVELS_PER_MAP; level++) {
    if (!isFlashLevelDone(progress, mapId, level)) {
      return level;
    }
  }
  return null;
}

/** All six levels cleared — the casino's table opens. */
export function isMapFlashComplete(progress: FlashProgress, mapId: number): boolean {
  return nextFlashLevel(progress, mapId) === null;
}
