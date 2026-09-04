import { mapById } from '../../engine/betting/casino';
import { objectivesForMap } from '../../engine/dojo/objectives';

describe('dojo objectives', () => {
  it('returns easier objectives for early casinos', () => {
    const luna = mapById(1)!;
    const objectives = objectivesForMap(luna);
    expect(objectives.length).toBeGreaterThan(0);
    const ids = objectives.map((o) => o.id);
    expect(ids).toContain('track-five-hands');
  });

  it('includes true-count objectives for multi-deck casinos', () => {
    const kepler = mapById(6)!;
    const objectives = objectivesForMap(kepler);
    const ids = objectives.map((o) => o.id);
    expect(ids).toContain('call-true-count');
  });
});
