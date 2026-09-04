import { buildValuesDrill, dealRunningDrill, dealSpeedDrill, scoreDrill } from '../../engine/dojo/hiLoDrill';
import { hiLoValue } from '../../engine/cards/card';

describe('dojo drills', () => {
  describe('values drill', () => {
    it('builds the requested number of cards with plausible choices', () => {
      const drill = buildValuesDrill(20);
      expect(drill).toHaveLength(20);
      for (const item of drill) {
        const correct = hiLoValue(item.card.rank);
        expect(item.choices).toContain(correct);
        expect(item.choices).toHaveLength(3);
      }
    });
  });

  describe('running drill', () => {
    it('deals cards and tracks the running count', () => {
      const drill = dealRunningDrill(1, 10, 5);
      expect(drill.cards).toHaveLength(10);
      expect(drill.deckCount).toBe(1);
      let expected = 0;
      for (const item of drill.cards) {
        expected += hiLoValue(item.card.rank);
        expect(item.runningCount).toBe(expected);
      }
    });

    it('places checkpoints at the requested interval', () => {
      const drill = dealRunningDrill(1, 12, 4);
      expect(drill.checkIndexes).toContain(3);
      expect(drill.checkIndexes).toContain(7);
      expect(drill.checkIndexes).toContain(11);
    });
  });

  describe('speed drill', () => {
    it('returns the final running count', () => {
      const drill = dealSpeedDrill(1, 8);
      expect(drill.cards).toHaveLength(8);
      expect(drill.finalCount).toBe(drill.cards[drill.cards.length - 1].runningCount);
    });
  });

  describe('scoreDrill', () => {
    it('awards full XP on a perfect run', () => {
      const result = scoreDrill(20, 20, 10);
      expect(result.accuracy).toBe(1);
      expect(result.xp).toBe(10);
    });

    it('scales XP by accuracy', () => {
      const result = scoreDrill(10, 20, 10);
      expect(result.accuracy).toBe(0.5);
      expect(result.xp).toBe(5);
    });
  });
});
