import { CASINO_MAPS, effectiveDealerSpeed, LUNA_LUXE } from '../../engine/betting/casino';

/**
 * Casino difficulty is the dealer's pace: each house up the ladder deals
 * quicker, and the player's dealer-speed setting stacks on top of the house
 * pace rather than replacing it.
 */
describe('dealer pace per casino', () => {
  it('the first casino deals at 1× and every casino after deals faster than the last', () => {
    expect(LUNA_LUXE.dealerPace).toBe(1);
    for (let i = 1; i < CASINO_MAPS.length; i++) {
      expect(CASINO_MAPS[i].dealerPace).toBeGreaterThan(CASINO_MAPS[i - 1].dealerPace);
    }
    expect(CASINO_MAPS[CASINO_MAPS.length - 1].dealerPace).toBeLessThanOrEqual(2);
  });

  it('the personal speed setting multiplies the house pace', () => {
    expect(effectiveDealerSpeed(LUNA_LUXE, 1)).toBe(1);
    expect(effectiveDealerSpeed(LUNA_LUXE, 1.5)).toBe(1.5);
    const fastest = CASINO_MAPS[CASINO_MAPS.length - 1];
    expect(effectiveDealerSpeed(fastest, 1)).toBe(fastest.dealerPace);
    expect(effectiveDealerSpeed(fastest, 0.5)).toBeCloseTo(fastest.dealerPace * 0.5);
  });

  it('falls back to the bare setting with no casino', () => {
    expect(effectiveDealerSpeed(null, 1.25)).toBe(1.25);
    expect(effectiveDealerSpeed(undefined, 0.75)).toBe(0.75);
  });
});
