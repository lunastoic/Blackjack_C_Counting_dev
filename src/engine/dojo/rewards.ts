import { CASINO_MAPS, mapById } from '../betting/casino';
import { DeckCover } from '../types';
import { FlashProgress, isFlashLevelDone } from './countFlash';

/**
 * The two mystery rewards on every casino's trail. The gift after level 1
 * gives the Ivory card back in the casino's own colours; the money bag after
 * level 3 pays chips. Each is claimed from a small pop-up on the trail.
 *
 * Each casino still owns a table tool (the counter's kit) and a preview
 * drill: the tool is earned by clearing the casino's level 1, and the drills
 * stay defined here for the screens that still open them.
 */

export const REWARD_SLOTS = [1, 2] as const;
export type RewardSlot = (typeof REWARD_SLOTS)[number];

/** The level that has to be cleared for each slot to open. */
export const REWARD_LEVEL: Readonly<Record<RewardSlot, number>> = { 1: 1, 2: 3 };

export const KIT_TOOL_IDS = [
  'pocketCard',
  'pairSpotter',
  'trayMarks',
  'trueCountReadout',
  'betRamp',
  'indexChart',
] as const;
export type KitToolId = (typeof KIT_TOOL_IDS)[number];

export const PREVIEW_DRILL_IDS = [
  'deckCountdown',
  'trayGlance',
  'divideIt',
  'rampCard',
  'sixteenVsTen',
  'casinoNight',
] as const;
export type PreviewDrillId = (typeof PREVIEW_DRILL_IDS)[number];

export interface KitTool {
  readonly id: KitToolId;
  readonly name: string;
  /** Short name for the trail pill. */
  readonly short: string;
  readonly blurb: string;
}

export interface PreviewDrill {
  readonly id: PreviewDrillId;
  readonly name: string;
  readonly blurb: string;
  /** What it is a taste of — "Io · speed". */
  readonly teases: string;
}

/** What a gift holds: a card back, dealt in the casino's own colours. */
export interface GiftCover {
  readonly cover: DeckCover;
  readonly name: string;
  readonly blurb: string;
}

export interface MapRewards {
  readonly mapId: number;
  /** The gift after level 1. */
  readonly gift: GiftCover;
  /** The counter's-kit tool earned by clearing level 1. */
  readonly tool: KitTool;
  readonly drill: PreviewDrill;
}

/** The Ivory card back: a cream card printed in the casino's colour. */
function ivoryGift(casino: string): GiftCover {
  return {
    cover: 'e',
    name: 'Ivory cards',
    blurb: `A cream card back printed in ${casino}'s colours. Equip it now, or switch card backs any time in Settings.`,
  };
}

export const MAP_REWARDS: Readonly<Record<number, MapRewards>> = {
  1: {
    mapId: 1,
    gift: ivoryGift('Luna Luxe'),
    tool: {
      id: 'pocketCard',
      name: 'Hi-Lo pocket card',
      short: 'Pocket card',
      blurb: 'The +1 · 0 · −1 chart tucked in a corner of the table — tap to peek.',
    },
    drill: {
      id: 'deckCountdown',
      name: 'Deck Countdown',
      blurb: 'A whole deck at speed, counted to the last card. It always finishes at 0.',
      teases: 'Io · speed',
    },
  },
  2: {
    mapId: 2,
    gift: ivoryGift('Io Inferno'),
    tool: {
      id: 'pairSpotter',
      name: 'Pair spotter',
      short: 'Pair spotter',
      blurb: 'Cards that cancel light up for a beat as they land on the felt.',
    },
    drill: {
      id: 'trayGlance',
      name: 'Tray Glance',
      blurb: 'Quick reads of the discard tray: how many decks are left?',
      teases: 'Europa · deck estimation',
    },
  },
  3: {
    mapId: 3,
    gift: ivoryGift('Europa'),
    tool: {
      id: 'trayMarks',
      name: 'Tray marks',
      short: 'Tray marks',
      blurb: 'Deck lines up the side of the discard tray, so a glance reads the decks dealt.',
    },
    drill: {
      id: 'divideIt',
      name: 'Divide It',
      blurb: 'Running count ÷ decks left, the clean way in: whole decks, whole answers.',
      teases: 'Ganymede · true count',
    },
  },
  4: {
    mapId: 4,
    gift: ivoryGift('Ganymede'),
    tool: {
      id: 'trueCountReadout',
      name: 'True-count readout',
      short: 'TC readout',
      blurb: 'Your true count beside the running count at the table, once you have proved the count.',
    },
    drill: {
      id: 'rampCard',
      name: 'Ramp Card',
      blurb: 'What is the bet at this true count? The ramp, ten times over.',
      teases: 'Titan · betting',
    },
  },
  5: {
    mapId: 5,
    gift: ivoryGift('Titan'),
    tool: {
      id: 'betRamp',
      name: 'Bet ramp card',
      short: 'Ramp card',
      blurb: 'True count → units, pinned beside the bet circle while you size a bet.',
    },
    drill: {
      id: 'sixteenVsTen',
      name: '16 vs 10',
      blurb: 'The most valuable index play: stand at 0 or higher, hit below.',
      teases: 'Kepler · index plays',
    },
  },
  6: {
    mapId: 6,
    gift: ivoryGift('Kepler'),
    tool: {
      id: 'indexChart',
      name: 'Index chart',
      short: 'Index chart',
      blurb: 'Every index play and insurance, a tap away at the table.',
    },
    drill: {
      id: 'casinoNight',
      name: 'Casino Night',
      blurb: 'A shoe with the pit boss watching: ramp your bets without drawing heat.',
      teases: 'playing for real',
    },
  },
};

export function mapRewards(mapId: number): MapRewards | undefined {
  return MAP_REWARDS[mapId];
}

/** The tool a casino's gift gives, by tool id. */
export function toolById(id: KitToolId): KitTool {
  return CASINO_MAPS.map((map) => MAP_REWARDS[map.id].tool).find((tool) => tool.id === id)!;
}

/** The casino whose gift gives this tool. */
export function mapForTool(id: KitToolId): number {
  return CASINO_MAPS.find((map) => MAP_REWARDS[map.id].tool.id === id)!.id;
}

/** The casino whose money bag carries this drill. */
export function mapForDrill(id: PreviewDrillId): number {
  return CASINO_MAPS.find((map) => MAP_REWARDS[map.id].drill.id === id)!.id;
}

/** "mapId:slot" — how an opened reward is stored. */
export function rewardKey(mapId: number, slot: RewardSlot): string {
  return `${mapId}:${slot}`;
}

/** The card back a casino's gift holds. */
export function giftCover(mapId: number): DeckCover | undefined {
  return MAP_REWARDS[mapId]?.gift.cover;
}

/** The money bag's chips: a tenth of the casino's table maximum. */
export function rewardChips(mapId: number): number {
  return Math.round((mapById(mapId)?.maxBet ?? 0) / 10);
}

/** True once the level under a reward is cleared, whether or not it has been opened. */
export function isRewardEarned(progress: FlashProgress, mapId: number, slot: RewardSlot): boolean {
  return isFlashLevelDone(progress, mapId, REWARD_LEVEL[slot]);
}

/** locked → ready (its level is cleared, gold on the trail) → opened (claimed). */
export type RewardState = 'locked' | 'ready' | 'opened';

export function rewardState(
  progress: FlashProgress,
  opened: ReadonlySet<string>,
  mapId: number,
  slot: RewardSlot,
): RewardState {
  if (opened.has(rewardKey(mapId, slot))) {
    return 'opened';
  }
  return isRewardEarned(progress, mapId, slot) ? 'ready' : 'locked';
}
