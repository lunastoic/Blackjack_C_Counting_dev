import { requirementTiles, shoeRunStarLabels, starUnit } from '../../components/training/copy';
import { ShoeRunLevel, trainingLevelSpec } from '../../engine/dojo';

const bare = (spec: Parameters<typeof requirementTiles>[0]) =>
  requirementTiles(spec).tiles.map((tile) => (tile.icon ? `[${tile.icon}] ${tile.label}` : `${tile.value} ${tile.label}`));

describe('requirementTiles', () => {
  it('Card Rain: misses, the check cadence, a timed exact entry', () => {
    const spec = trainingLevelSpec(1, 4);
    expect(bare(spec)).toEqual(['2 misses allowed', '5–10 cards a check', '[timer] timed answer', '[keypad] exact entry']);
    expect(requirementTiles(spec).note).toBeUndefined();
  });

  it('Table Night at Luna: hands, the deck, the clock; what is graded as the note', () => {
    const spec = trainingLevelSpec(1, 5);
    expect(bare(spec)).toEqual(['10 hands', '1 deck', '8s per count call']);
    expect(requirementTiles(spec).note).toBe('Graded: counts');
  });

  it('Zero Hero: rounds to clear, where the deal stops, a fresh deck each round', () => {
    const spec = trainingLevelSpec(1, 6);
    expect(bare(spec)).toEqual(['2 / 3 rounds to clear', '39–48 stops at card', '[timer] timed answer', '[keypad] exact entry']);
    expect(requirementTiles(spec).note).toBe('A fresh deck each round');
    expect(starUnit(spec)).toBe('rounds');
  });

  it('Cancel Out: strikes and the meter; stars count grids', () => {
    const spec = trainingLevelSpec(1, 2);
    expect(bare(spec)).toEqual(['3 strikes', '[timer] meter runs with the grid up']);
    expect(starUnit(spec)).toBe('grids');
  });

  it('Casino Speed: a single strike', () => {
    expect(bare(trainingLevelSpec(6, 1))).toEqual(['1 strike']);
  });

  it('Count-Along at Ganymede: the table and its players', () => {
    expect(bare(trainingLevelSpec(4, 6))).toEqual(['2 misses allowed', '6 decks', '[players] 3 players + dealer', '[keypad] exact entry']);
  });

  it('Clean Shoe: the boss’s two strike counts', () => {
    expect(bare(trainingLevelSpec(2, 6))).toEqual(['40 hands', '2 decks', '3+3 move / count strikes']);
  });

  it('Beat the Casino: the pit boss, and the back-off in the note', () => {
    const spec = trainingLevelSpec(6, 6);
    expect(bare(spec)).toEqual(['60 hands', '8 decks', '[flame] pit boss watches']);
    expect(requirementTiles(spec).note).toBe(
      'Graded: counts, bets, insurance, index plays · ramp too fast and the pit boss backs you off',
    );
  });

  it('a shoe run’s star tiles follow its pass marks', () => {
    expect(shoeRunStarLabels(trainingLevelSpec(1, 5) as ShoeRunLevel)).toEqual(['finish', '80% right', '100% right']);
    expect(shoeRunStarLabels(trainingLevelSpec(6, 6) as ShoeRunLevel)).toEqual(['finish', '90% right', '100% right']);
  });
});
