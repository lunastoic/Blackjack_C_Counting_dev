import {
  appAssets,
  CHIP_SETS,
  DECK_COVER_ART,
  LEVEL_ART,
  MAP_ART,
  MODERN_CHIP_SETS,
  TABLE_FELTS,
} from '../../assets/registry';
import { CARD_BACK, CARD_FACES } from '../../assets/cards.generated';
import { CASINO_MAPS } from '../../engine/betting/casino';
import { RANKS, SUITS } from '../../engine/cards/card';
import { trainingLevelsForMap } from '../../engine/dojo';
import { DECK_COVERS } from '../../engine/types';

/**
 * Completeness check: every registry entry must resolve to a bundleable
 * static asset (jest-expo stubs require()'d images, but a missing file would
 * fail module resolution and break this suite).
 */
describe('asset registry', () => {
  it('resolves every registered foundation asset', () => {
    expect(appAssets.branding.title).toBeDefined();
    expect(appAssets.branding.appIcon).toBeDefined();
    expect(appAssets.dealer.hero).toBeDefined();
    expect(appAssets.icons.lock).toBeDefined();
    expect(appAssets.icons.unlock).toBeDefined();
    expect(appAssets.shoeDeck).toBeDefined();
  });

  it('contains exactly the approved asset groups', () => {
    expect(Object.keys(appAssets).sort()).toEqual(['branding', 'buttons', 'dealer', 'icons', 'shoeDeck']);
  });

  it('resolves all 52 faces of every deck plus the card back', () => {
    for (const skin of ['regular', 'luna', 'training'] as const) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          expect(CARD_FACES[skin][suit][rank]).toBeDefined();
        }
      }
    }
    expect(CARD_BACK).toBeDefined();
  });

  it('resolves all gameplay buttons', () => {
    for (const button of Object.values(appAssets.buttons)) {
      expect(button).toBeDefined();
    }
  });

  it('resolves felt, map art, and every chip denomination for all six casinos', () => {
    for (const map of CASINO_MAPS) {
      expect(TABLE_FELTS[map.feltKey]).toBeDefined();
      expect(MAP_ART[map.artKey]).toBeDefined();
      const chipSet = CHIP_SETS[map.chipSetKey];
      expect(chipSet).toBeDefined();
      for (const value of map.chipDenominations) {
        expect(chipSet[value]).toBeDefined();
      }
    }
  });

  it('gives every casino a Modern chip for each of its denominations', () => {
    for (const map of CASINO_MAPS) {
      const chipSet = MODERN_CHIP_SETS[map.chipSetKey];
      expect(chipSet).toBeDefined();
      expect(Object.keys(chipSet).map(Number).sort((a, b) => a - b)).toEqual([
        ...map.chipDenominations,
      ]);
      for (const value of map.chipDenominations) {
        expect(chipSet[value]).toBeDefined();
      }
    }
  });

  it('gives Kepler its own Modern chips on the Titan denominations', () => {
    const kepler = CASINO_MAPS.find((map) => map.name === 'Kepler Fortune');
    const titan = CASINO_MAPS.find((map) => map.name === 'Titan Methane Mirage');
    expect(kepler?.chipSetKey).toBe('kepler');
    expect(kepler?.chipDenominations).toEqual(titan?.chipDenominations);
    expect(MODERN_CHIP_SETS.kepler).not.toBe(MODERN_CHIP_SETS.titan);
  });

  it('resolves every casino in every deck cover style', () => {
    for (const cover of DECK_COVERS) {
      for (const map of CASINO_MAPS) {
        expect(DECK_COVER_ART[cover][map.id]).toBeDefined();
      }
    }
  });

  it('gives every Luna Luxe level its own art and leaves the other casinos on chips', () => {
    for (const spec of trainingLevelsForMap(1)) {
      expect(LEVEL_ART[1][spec.level]).toBeDefined();
    }
    expect(Object.keys(LEVEL_ART)).toEqual(['1']);
  });
});
