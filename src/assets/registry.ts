/**
 * Typed static asset registry. React Native requires literal require() calls —
 * never build image paths at runtime. CHIP_SETS / TABLE_FELTS / MAP_ART are
 * keyed by the engine's CasinoMap chipSetKey / feltKey / artKey so map-specific
 * presentation is pure data lookup.
 */

/** Chip art per set, keyed by denomination. Kepler reuses the Titan set (no themed art exists). */
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
    /** 1024×1024 original app icon (also wired in app.json). */
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
