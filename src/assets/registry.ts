/**
 * Typed static asset registry. React Native requires literal require() calls —
 * never build image paths at runtime. CHIP_SETS / TABLE_FELTS / MAP_ART are
 * keyed by the engine's CasinoMap chipSetKey / feltKey / artKey so map-specific
 * presentation is pure data lookup.
 */

import { DeckCover } from '../engine/types';

/** Classic chip art per set, keyed by denomination. Kepler's Classic set is Titan's (no themed art). */
export const CHIP_SETS: Record<string, Record<number, number>> = {
  default: {
    1: require('../../assets/chips/default/chip-1.png'),
    5: require('../../assets/chips/default/chip-5.png'),
    25: require('../../assets/chips/default/chip-25.png'),
    50: require('../../assets/chips/default/chip-50.png'),
    100: require('../../assets/chips/default/chip-100.png'),
  },
  inferno: {
    5: require('../../assets/chips/inferno/chip-5.png'),
    25: require('../../assets/chips/inferno/chip-25.png'),
    50: require('../../assets/chips/inferno/chip-50.png'),
    250: require('../../assets/chips/inferno/chip-250.png'),
    500: require('../../assets/chips/inferno/chip-500.png'),
  },
  europa: {
    25: require('../../assets/chips/europa/chip-25.png'),
    50: require('../../assets/chips/europa/chip-50.png'),
    100: require('../../assets/chips/europa/chip-100.png'),
    500: require('../../assets/chips/europa/chip-500.png'),
    1000: require('../../assets/chips/europa/chip-1000.png'),
  },
  ganymede: {
    100: require('../../assets/chips/ganymede/chip-100.png'),
    250: require('../../assets/chips/ganymede/chip-250.png'),
    500: require('../../assets/chips/ganymede/chip-500.png'),
    2500: require('../../assets/chips/ganymede/chip-2500.png'),
    5000: require('../../assets/chips/ganymede/chip-5000.png'),
  },
  titan: {
    250: require('../../assets/chips/titan/chip-250.png'),
    1000: require('../../assets/chips/titan/chip-1000.png'),
    2500: require('../../assets/chips/titan/chip-2500.png'),
    10000: require('../../assets/chips/titan/chip-10000.png'),
    25000: require('../../assets/chips/titan/chip-25000.png'),
  },
  kepler: {
    250: require('../../assets/chips/titan/chip-250.png'),
    1000: require('../../assets/chips/titan/chip-1000.png'),
    2500: require('../../assets/chips/titan/chip-2500.png'),
    10000: require('../../assets/chips/titan/chip-10000.png'),
    25000: require('../../assets/chips/titan/chip-25000.png'),
  },
};

/**
 * The Modern look's chips, keyed by the engine's chipSetKey then denomination:
 * the bevelled disc with its ink outline baked in, 500×500 edge to edge, one
 * set per casino. A denomination missing here falls back to the code-drawn chip.
 */
export const MODERN_CHIP_SETS: Record<string, Record<number, number>> = {
  default: {
    1: require('../../assets/chips/modern/default/chip-1.png'),
    5: require('../../assets/chips/modern/default/chip-5.png'),
    25: require('../../assets/chips/modern/default/chip-25.png'),
    50: require('../../assets/chips/modern/default/chip-50.png'),
    100: require('../../assets/chips/modern/default/chip-100.png'),
  },
  inferno: {
    5: require('../../assets/chips/modern/inferno/chip-5.png'),
    25: require('../../assets/chips/modern/inferno/chip-25.png'),
    50: require('../../assets/chips/modern/inferno/chip-50.png'),
    250: require('../../assets/chips/modern/inferno/chip-250.png'),
    500: require('../../assets/chips/modern/inferno/chip-500.png'),
  },
  europa: {
    25: require('../../assets/chips/modern/europa/chip-25.png'),
    50: require('../../assets/chips/modern/europa/chip-50.png'),
    100: require('../../assets/chips/modern/europa/chip-100.png'),
    500: require('../../assets/chips/modern/europa/chip-500.png'),
    1000: require('../../assets/chips/modern/europa/chip-1000.png'),
  },
  ganymede: {
    100: require('../../assets/chips/modern/ganymede/chip-100.png'),
    250: require('../../assets/chips/modern/ganymede/chip-250.png'),
    500: require('../../assets/chips/modern/ganymede/chip-500.png'),
    2500: require('../../assets/chips/modern/ganymede/chip-2500.png'),
    5000: require('../../assets/chips/modern/ganymede/chip-5000.png'),
  },
  titan: {
    250: require('../../assets/chips/modern/titan/chip-250.png'),
    1000: require('../../assets/chips/modern/titan/chip-1000.png'),
    2500: require('../../assets/chips/modern/titan/chip-2500.png'),
    10000: require('../../assets/chips/modern/titan/chip-10000.png'),
    25000: require('../../assets/chips/modern/titan/chip-25000.png'),
  },
  kepler: {
    250: require('../../assets/chips/modern/kepler/chip-250.png'),
    1000: require('../../assets/chips/modern/kepler/chip-1000.png'),
    2500: require('../../assets/chips/modern/kepler/chip-2500.png'),
    10000: require('../../assets/chips/modern/kepler/chip-10000.png'),
    25000: require('../../assets/chips/modern/kepler/chip-25000.png'),
  },
};

/**
 * The Modern card backs, keyed by style then casino id: one design per style,
 * each casino in its own colours (500×700, full bleed like the card faces).
 */
export const DECK_COVER_ART: Readonly<Record<DeckCover, Record<number, number>>> = {
  d: {
    1: require('../../assets/cards/covers/luna-d.png'),
    2: require('../../assets/cards/covers/inferno-d.png'),
    3: require('../../assets/cards/covers/europa-d.png'),
    4: require('../../assets/cards/covers/ganymede-d.png'),
    5: require('../../assets/cards/covers/titan-d.png'),
    6: require('../../assets/cards/covers/kepler-d.png'),
  },
  e: {
    1: require('../../assets/cards/covers/luna-e.png'),
    2: require('../../assets/cards/covers/inferno-e.png'),
    3: require('../../assets/cards/covers/europa-e.png'),
    4: require('../../assets/cards/covers/ganymede-e.png'),
    5: require('../../assets/cards/covers/titan-e.png'),
    6: require('../../assets/cards/covers/kepler-e.png'),
  },
  f: {
    1: require('../../assets/cards/covers/luna-f.png'),
    2: require('../../assets/cards/covers/inferno-f.png'),
    3: require('../../assets/cards/covers/europa-f.png'),
    4: require('../../assets/cards/covers/ganymede-f.png'),
    5: require('../../assets/cards/covers/titan-f.png'),
    6: require('../../assets/cards/covers/kepler-f.png'),
  },
};

/** Suede felts keyed by the engine's feltKey. */
export const TABLE_FELTS: Record<string, number> = {
  'gray-suede': require('../../assets/tables/gray-suede.png'),
  'orange-suede': require('../../assets/tables/orange-suede.png'),
  'blue-suede': require('../../assets/tables/blue-suede.png'),
  'purple-suede': require('../../assets/tables/purple-suede.png'),
  'green-suede': require('../../assets/tables/green-suede.png'),
  'yellow-suede': require('../../assets/tables/yellow-suede.png'),
};

/**
 * The Modern look's felts: the same suede nap over one base colour per map,
 * vignette baked in, keyed by the engine's feltKey. A map without one here
 * falls back to its Classic felt.
 */
export const MODERN_TABLE_FELTS: Record<string, number> = {
  'gray-suede': require('../../assets/tables/modern/graphite-suede.jpg'),
};

/**
 * Level-node art on the ladder, keyed by casino id then level. Luna Luxe's
 * six are painted; the other casinos' are drawn in the same style with their
 * own card backs. A level missing here shows chip art.
 */
export const LEVEL_ART: Record<number, Record<number, number>> = {
  1: {
    1: require('../../assets/levels/map1/level-1.png'),
    2: require('../../assets/levels/map1/level-2.png'),
    3: require('../../assets/levels/map1/level-3.png'),
    4: require('../../assets/levels/map1/level-4.png'),
    5: require('../../assets/levels/map1/level-5.png'),
    6: require('../../assets/levels/map1/level-6.png'),
  },
  2: {
    1: require('../../assets/levels/map2/level-1.png'),
    2: require('../../assets/levels/map2/level-2.png'),
    3: require('../../assets/levels/map2/level-3.png'),
    4: require('../../assets/levels/map2/level-4.png'),
    5: require('../../assets/levels/map2/level-5.png'),
    6: require('../../assets/levels/map2/level-6.png'),
  },
  3: {
    1: require('../../assets/levels/map3/level-1.png'),
    2: require('../../assets/levels/map3/level-2.png'),
    3: require('../../assets/levels/map3/level-3.png'),
    4: require('../../assets/levels/map3/level-4.png'),
    5: require('../../assets/levels/map3/level-5.png'),
    6: require('../../assets/levels/map3/level-6.png'),
  },
  4: {
    1: require('../../assets/levels/map4/level-1.png'),
    2: require('../../assets/levels/map4/level-2.png'),
    3: require('../../assets/levels/map4/level-3.png'),
    4: require('../../assets/levels/map4/level-4.png'),
    5: require('../../assets/levels/map4/level-5.png'),
    6: require('../../assets/levels/map4/level-6.png'),
  },
  5: {
    1: require('../../assets/levels/map5/level-1.png'),
    2: require('../../assets/levels/map5/level-2.png'),
    3: require('../../assets/levels/map5/level-3.png'),
    4: require('../../assets/levels/map5/level-4.png'),
    5: require('../../assets/levels/map5/level-5.png'),
    6: require('../../assets/levels/map5/level-6.png'),
  },
  6: {
    1: require('../../assets/levels/map6/level-1.png'),
    2: require('../../assets/levels/map6/level-2.png'),
    3: require('../../assets/levels/map6/level-3.png'),
    4: require('../../assets/levels/map6/level-4.png'),
    5: require('../../assets/levels/map6/level-5.png'),
    6: require('../../assets/levels/map6/level-6.png'),
  },
};

/**
 * The two mystery rewards on each casino's trail: the wrapped gift and money
 * bag while they wait, and what they open to — a table tool, or the chips
 * and the preview drill they carry.
 */
export const REWARD_ART = {
  gift: {
    1: require('../../assets/rewards/gift-1.png'),
    2: require('../../assets/rewards/gift-2.png'),
    3: require('../../assets/rewards/gift-3.png'),
    4: require('../../assets/rewards/gift-4.png'),
    5: require('../../assets/rewards/gift-5.png'),
    6: require('../../assets/rewards/gift-6.png'),
  } as Record<number, number>,
  bag: {
    1: require('../../assets/rewards/bag-1.png'),
    2: require('../../assets/rewards/bag-2.png'),
    3: require('../../assets/rewards/bag-3.png'),
    4: require('../../assets/rewards/bag-4.png'),
    5: require('../../assets/rewards/bag-5.png'),
    6: require('../../assets/rewards/bag-6.png'),
  } as Record<number, number>,
  tool: {
    pocketCard: require('../../assets/rewards/tool-pocketCard.png'),
    pairSpotter: require('../../assets/rewards/tool-pairSpotter.png'),
    trayMarks: require('../../assets/rewards/tool-trayMarks.png'),
    trueCountReadout: require('../../assets/rewards/tool-trueCountReadout.png'),
    betRamp: require('../../assets/rewards/tool-betRamp.png'),
    indexChart: require('../../assets/rewards/tool-indexChart.png'),
  } as Record<string, number>,
  drill: {
    deckCountdown: require('../../assets/rewards/drill-deckCountdown.png'),
    trayGlance: require('../../assets/rewards/drill-trayGlance.png'),
    divideIt: require('../../assets/rewards/drill-divideIt.png'),
    rampCard: require('../../assets/rewards/drill-rampCard.png'),
    sixteenVsTen: require('../../assets/rewards/drill-sixteenVsTen.png'),
    casinoNight: require('../../assets/rewards/drill-casinoNight.png'),
  } as Record<string, number>,
};

/** Casino artwork keyed by the engine's artKey. */
export const MAP_ART: Record<string, number> = {
  'luna-luxe': require('../../assets/maps/luna-luxe.png'),
  inferno: require('../../assets/maps/inferno.png'),
  europa: require('../../assets/maps/europa.png'),
  ganymede: require('../../assets/maps/ganymede.png'),
  titan: require('../../assets/maps/titan.png'),
  kepler: require('../../assets/maps/kepler.png'),
};

export const appAssets = {
  branding: {
    /** 600×160 title art from the original AppAssets catalog. */
    title: require('../../assets/branding/title.png'),
    /** 1024×1024 app icon (also wired in app.json); v1/v2 art kept beside it. */
    appIcon: require('../../assets/branding/app-icon.png'),
  },
  dealer: {
    /** 1024×1024 house dealer portrait. */
    hero: require('../../assets/dealer/house-dealer.png'),
  },
  icons: {
    lock: require('../../assets/maps/lock.png'),
    unlock: require('../../assets/maps/unlock.png'),
  },
  buttons: {
    hit: require('../../assets/buttons/hit.png'),
    stand: require('../../assets/buttons/stand.png'),
    double: require('../../assets/buttons/double.png'),
    split: require('../../assets/buttons/split.png'),
    deal: require('../../assets/buttons/deal.png'),
    redoBet: require('../../assets/buttons/redo-bet.png'),
  },
  /** Full shoe stack — single art asset cards deal from (top-right). */
  shoeDeck: require('../../assets/cards/deck-cover.png'),
} as const;

export { CARD_FACES, CARD_BACK } from './cards.generated';
export type { CardSkin } from './cards.generated';
