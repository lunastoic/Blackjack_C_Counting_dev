import { appAssets, CHIP_SETS, MAP_ART, TABLE_FELTS } from '../../assets/registry';
import { CARD_BACK, CARD_FACES } from '../../assets/cards.generated';
import { CASINO_MAPS } from '../../engine/betting/casino';
import { RANKS, SUITS } from '../../engine/cards/card';

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

  it('resolves all 52 regular and 52 training card faces plus the card back', () => {
    for (const skin of ['regular', 'training'] as const) {
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
});
