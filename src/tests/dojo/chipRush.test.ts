import {
  chipRushBet,
  chipRushCrossMs,
  chipRushTrueCount,
  CHIP_RUSH_TC_MAX,
  CHIP_RUSH_TC_MIN,
  flashLevelKey,
  trainingLevelSpec,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { createDefaultSave } from '../../persistence/defaults';
import { __resetPersistenceForTests } from '../../persistence/hydrate';
import { __setChipRushRngForTests, frontCard, useChipRushStore } from '../../stores/chipRushStore';
import { useDojoStore } from '../../stores/dojoStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';

const store = () => useChipRushStore.getState();

function frontBet(): number {
  const front = frontCard(store().cards);
  if (!front) {
    throw new Error('no card on the lane');
  }
  return chipRushBet(front.trueCount);
}

/** Bets right on every card until the wave ends (status leaves 'playing'). */
function playWaveRight(): void {
  let guard = 0;
  while (store().status === 'playing' && guard++ < 2000) {
    if (store().cards.length === 0) {
      jest.advanceTimersByTime(100);
      continue;
    }
    expect(store().bet(frontBet())).toBe(true);
  }
}

describe('chip rush — the lane', () => {
  it('eases each wave faster, from the first crossing time to the last', () => {
    const spec = { waves: 3, crossMsStart: 6000, crossMsEnd: 3500 };
    expect(chipRushCrossMs(spec, 0)).toBe(6000);
    expect(chipRushCrossMs(spec, 1)).toBe(4750);
    expect(chipRushCrossMs(spec, 2)).toBe(3500);
  });

  it('deals true counts from a cold shoe to past the top of the spread', () => {
    const random = seededRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const tc = chipRushTrueCount(random);
      expect(tc).toBeGreaterThanOrEqual(CHIP_RUSH_TC_MIN);
      expect(tc).toBeLessThanOrEqual(CHIP_RUSH_TC_MAX);
      seen.add(tc);
    }
    expect(seen.size).toBe(CHIP_RUSH_TC_MAX - CHIP_RUSH_TC_MIN + 1);
    expect(chipRushBet(-2)).toBe(1);
    expect(chipRushBet(3)).toBe(2);
    expect(chipRushBet(9)).toBe(8);
  });
});

describe('chip rush — the level', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetPersistenceForTests();
    const defaults = createDefaultSave();
    useDojoStore.getState().hydrate(defaults.dojo);
    useEconomyStore.getState().hydrate(defaults.economy);
    useProgressionStore.getState().hydrate(defaults.progression);
    useSettingsStore.getState().hydrate(defaults.settings);
    __setChipRushRngForTests(seededRng(9));
    store().load(4, 2);
  });

  afterEach(() => {
    store().reset();
    __setChipRushRngForTests();
    jest.useRealTimers();
  });

  it('is Ganymede level 2: three waves of ten, two strikes', () => {
    expect(trainingLevelSpec(4, 2)).toMatchObject({ mode: 'chipRush', waves: 3, cardsPerWave: 10, strikes: 2 });
    expect(store().targets).toEqual([1, 2, 3]);
    expect(store().status).toBe('idle');
  });

  it('a card spawns at once, the next after half a crossing, and the front card is the oldest', () => {
    store().begin();
    expect(store().status).toBe('playing');
    expect(store().cards).toHaveLength(1);
    const first = store().cards[0];
    jest.advanceTimersByTime(first.crossMs / 2);
    expect(store().cards).toHaveLength(2);
    expect(frontCard(store().cards)?.id).toBe(first.id);
  });

  it('a right bet clears the front card and grows the combo; a wrong one is a strike and the card stays', () => {
    store().begin();
    const front = frontCard(store().cards)!;
    const right = chipRushBet(front.trueCount);
    const wrong = right === 8 ? 7 : right + 1;
    expect(store().bet(wrong)).toBe(false);
    expect(store().misses).toBe(1);
    expect(store().lastMiss).toMatchObject({ reason: 'wrong', correct: right });
    expect(store().cards.some((card) => card.id === front.id)).toBe(true);
    expect(store().combo).toBe(0);
    expect(store().bet(right)).toBe(true);
    expect(store().cards.some((card) => card.id === front.id)).toBe(false);
    expect(store().combo).toBe(1);
  });

  it('a card that reaches the edge is a strike and leaves the lane; a third strike ends the run', () => {
    store().begin();
    const first = store().cards[0];
    jest.advanceTimersByTime(first.crossMs);
    expect(store().cards.some((card) => card.id === first.id)).toBe(false);
    expect(store().misses).toBe(1);
    expect(store().lastMiss?.reason).toBe('escape');
    let guard = 0;
    while (store().status === 'playing' && guard++ < 100) {
      jest.advanceTimersByTime(500);
    }
    expect(store().status).toBe('failed');
    expect(store().misses).toBe(3);
    expect(store().cards).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a wave played right banks a star; the second pauses at the clear, the third ends the run', () => {
    store().begin();
    playWaveRight();
    expect(store().wavesDone).toBe(1);
    expect(store().stars).toBe(1);
    expect(store().status).toBe('feedback');
    jest.advanceTimersByTime(1000);
    expect(store().status).toBe('playing');
    expect(store().wave).toBe(1);
    expect(store().cards[0].crossMs).toBe(4750);
    playWaveRight();
    expect(store().status).toBe('cleared');
    expect(store().stars).toBe(2);
    expect(jest.getTimerCount()).toBe(0);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(4, 2)]).toBe(2);
    store().keepGoing();
    expect(store().wave).toBe(2);
    playWaveRight();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(3);
    expect(store().comboBest).toBe(30);
    expect(useDojoStore.getState().flashLevels[flashLevelKey(4, 2)]).toBe(3);
    expect(useDojoStore.getState().flashBests[flashLevelKey(4, 2)]?.run).toBe(3);
  });

  it('Stop at the clear banks two stars and ends the run', () => {
    store().begin();
    playWaveRight();
    jest.advanceTimersByTime(1000);
    playWaveRight();
    store().stopRun();
    expect(store().status).toBe('levelComplete');
    expect(store().stars).toBe(2);
  });

  it('bets outside play are ignored', () => {
    expect(store().bet(1)).toBe(false);
    store().begin();
    playWaveRight();
    expect(store().status).toBe('feedback');
    expect(store().bet(1)).toBe(false);
  });
});
