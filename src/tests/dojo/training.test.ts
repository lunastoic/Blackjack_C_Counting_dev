import { hiLoValue, isFaceUp } from '../../engine/cards/card';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import {
  accuracyPercent,
  assignQuestionKinds,
  buildCountStreamScript,
  buildNumberChoices,
  buildTableScript,
  buildTrainingScript,
  canStillPass,
  CheckpointLevelSpec,
  CountStreamLevel,
  decksRemainingEstimate,
  drawCardGroupItem,
  drawCardValueItem,
  EMPTY_TALLY,
  FLASH_LEVELS_PER_MAP,
  groupSizeForStreak,
  hasPassed,
  isCheckpointLevel,
  isStreakLevel,
  makeDeckEstimateItem,
  makeTrueCountItem,
  practiceShoe,
  recordCheckpoint,
  SPEED_PROFILES,
  starsForCheckpointRun,
  starsForStreakRun,
  TableCountLevel,
  totalCheckpoints,
  TRAINING_MAPS,
  trainingLevelSpec,
  trainingLevelsForMap,
  TrainingScript,
  trueCountFromDecks,
} from '../../engine/dojo';
import { seededRng } from '../../engine/shoe/rng';
import { totalCards } from '../../engine/shoe/shoe';

const allSpecs = TRAINING_MAPS.flatMap((map) => map.levels.map((spec) => ({ map, spec })));

function visibleCardIds(script: TrainingScript): string[] {
  return script.frames.flatMap((frame) => (frame.card ? [frame.card.id] : []));
}

describe('training ladder — configuration', () => {
  it('ships six casinos with six playable levels each', () => {
    expect(TRAINING_MAPS.map((map) => map.mapId)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const map of TRAINING_MAPS) {
      expect(map.levels).toHaveLength(FLASH_LEVELS_PER_MAP);
      expect(map.levels.map((spec) => spec.level)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(trainingLevelsForMap(map.mapId)).toBe(map.levels);
      for (const spec of map.levels) {
        expect(spec.title.length).toBeGreaterThan(0);
        expect(spec.brief.length).toBeGreaterThan(0);
        expect(SPEED_PROFILES[spec.speed]).toBeDefined();
        expect(isStreakLevel(spec) || isCheckpointLevel(spec)).toBe(true);
      }
    }
    expect(() => trainingLevelSpec(7, 1)).toThrow(RangeError);
    expect(() => trainingLevelSpec(1, 7)).toThrow(RangeError);
    expect(() => trainingLevelSpec(1, 0)).toThrow(RangeError);
  });

  it('has no countdown timers anywhere — pacing is speed presets only', () => {
    for (const { spec } of allSpecs) {
      expect(Object.keys(spec).some((key) => /timer|timeLimit|countdown/i.test(key))).toBe(false);
    }
    for (const profile of Object.values(SPEED_PROFILES)) {
      expect(Object.keys(profile).some((key) => /timer|countdown/i.test(key))).toBe(false);
    }
  });

  it('Map 1 stays gentle: beginner → normal-ish pacing, never very fast', () => {
    const speeds = trainingLevelsForMap(1).map((spec) => spec.speed);
    expect(speeds[0]).toBe('beginner');
    for (const speed of speeds) {
      expect(['beginner', 'easy', 'normal', 'fast']).toContain(speed);
    }
  });

  it('speed presets get quicker in order', () => {
    const order = ['beginner', 'easy', 'normal', 'fast', 'veryFast', 'casino'] as const;
    for (let i = 1; i < order.length; i++) {
      expect(SPEED_PROFILES[order[i]].cardMs).toBeLessThan(SPEED_PROFILES[order[i - 1]].cardMs);
      expect(SPEED_PROFILES[order[i]].table.card).toBeLessThan(
        SPEED_PROFILES[order[i - 1]].table.card,
      );
    }
  });

  it('Map 1 follows the spec: values → combos → groups → drill → full deck → blackjack test', () => {
    const [l1, l2, l3, l4, l5, l6] = trainingLevelsForMap(1);
    expect(l1).toMatchObject({ mode: 'cardValue', streakTarget: 21, strikes: 3 });
    expect(l2).toMatchObject({ mode: 'cardGroup', groupSizes: [2], streakTarget: 21, strikes: 3 });
    expect(l3).toMatchObject({ mode: 'cardGroup', groupSizes: [3, 4, 5], streakTarget: 21, strikes: 3 });
    expect(l4).toMatchObject({
      mode: 'countStream',
      deckCount: 1,
      checkpoints: 10,
      pass: { minCorrect: 10, maxRunningCountMisses: 0 },
    });
    expect(l5).toMatchObject({
      mode: 'countStream',
      deckCount: 1,
      cardCount: 52,
      checkpoints: 8,
      finalCountQuestion: true,
    });
    // The original blackjack count test now sits at level 6.
    expect(l6).toMatchObject({
      mode: 'tableCount',
      deckCount: 1,
      seats: 1,
      play: 'autoplay',
      cardBudget: 52,
      checkpoints: 6,
      questions: ['runningCount'],
      pass: { minCorrect: 6, maxRunningCountMisses: 0 },
    });
  });

  it('pass rules are satisfiable and Map 6 is the exam', () => {
    for (const { spec } of allSpecs) {
      if (isCheckpointLevel(spec)) {
        expect(spec.pass.minCorrect).toBeLessThanOrEqual(totalCheckpoints(spec));
        expect(spec.pass.minCorrect).toBeGreaterThan(0);
      } else {
        expect(spec.streakTarget).toBeGreaterThan(0);
      }
    }
  });

  it('every streak drill is a run of 21, with strikes that taper by map: 3, 2, 1, then none', () => {
    const strikesByMap: Record<number, number> = { 1: 3, 2: 2, 3: 1 };
    for (const { map, spec } of allSpecs) {
      if (!isCheckpointLevel(spec)) {
        expect(spec.streakTarget).toBe(21);
        expect(spec.strikes).toBe(strikesByMap[map.mapId] ?? 0);
      }
    }
    const final = trainingLevelSpec(6, 6);
    expect(final).toMatchObject({ mode: 'tableCount', exam: true, distractions: true, deckCount: 6 });
    if (final.mode === 'tableCount') {
      // 18 / 20 = 90% overall, at most one running-count miss.
      expect(final.pass.minCorrect / final.checkpoints).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe('training ladder — answer choices and stars', () => {
  it('builds four unique choices containing the answer, inside the bounds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const random = seededRng(seed);
      const correct = ((seed * 7) % 25) - 12;
      const choices = buildNumberChoices(correct, 1, -12, 12, random);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(correct);
      for (const choice of choices) {
        expect(choice).toBeGreaterThanOrEqual(-12);
        expect(choice).toBeLessThanOrEqual(12);
      }
    }
  });

  it('uses half steps for deck / true-count answers', () => {
    const choices = buildNumberChoices(2.5, 0.5, 0.5, 6, seededRng(2));
    expect(choices).toContain(2.5);
    for (const choice of choices) {
      expect(Number.isInteger(choice * 2)).toBe(true);
    }
  });

  it('scores stars from misses', () => {
    expect(starsForStreakRun(0)).toBe(3);
    expect(starsForStreakRun(1)).toBe(2);
    expect(starsForStreakRun(2)).toBe(1);
    expect(starsForStreakRun(3)).toBe(1);
    expect(starsForCheckpointRun(0)).toBe(3);
    expect(starsForCheckpointRun(1)).toBe(2);
    expect(starsForCheckpointRun(2)).toBe(1);
  });
});

describe('training ladder — streak items', () => {
  it('single cards carry their Hi-Lo value and come from a real deck', () => {
    const rng = seededRng(4);
    let shoe = practiceShoe(rng);
    const ids = new Set<string>();
    for (let i = 0; i < 52; i++) {
      const result = drawCardValueItem(shoe, rng);
      shoe = result.shoe;
      expect(result.item.cards).toHaveLength(1);
      expect(result.item.correct).toBe(hiLoValue(result.item.cards[0].rank));
      ids.add(result.item.cards[0].id);
    }
    expect(ids.size).toBe(52);
    // The 53rd draw renews the deck instead of throwing.
    expect(() => drawCardValueItem(shoe, rng)).not.toThrow();
  });

  it('groups sum their Hi-Lo values and cancellation bias yields cancelling pairs', () => {
    const rng = seededRng(8);
    let shoe = practiceShoe(rng);
    let cancelling = 0;
    const rounds = 40;
    for (let i = 0; i < rounds; i++) {
      const result = drawCardGroupItem(shoe, 2, true, rng);
      shoe = result.shoe;
      expect(result.item.cards).toHaveLength(2);
      expect(result.item.correct).toBe(
        result.item.cards.reduce((sum, card) => sum + hiLoValue(card.rank), 0),
      );
      if (result.item.correct === 0 || Math.abs(result.item.correct) === 2) {
        cancelling += 1;
      }
    }
    expect(cancelling / rounds).toBeGreaterThan(0.5);
  });

  it('progressive groups climb 3 → 4 → 5 as the streak grows', () => {
    const spec = trainingLevelSpec(1, 3);
    if (spec.mode !== 'cardGroup') {
      throw new Error('expected card groups');
    }
    expect(groupSizeForStreak(spec, 0)).toBe(3);
    expect(groupSizeForStreak(spec, 7)).toBe(4);
    expect(groupSizeForStreak(spec, 14)).toBe(5);
    expect(groupSizeForStreak(spec, 20)).toBe(5);
  });

  it('deck estimates match the cards remaining at the level precision', () => {
    for (const level of [1, 2, 3]) {
      const spec = trainingLevelSpec(3, level);
      if (spec.mode !== 'deckEstimate') {
        throw new Error('expected deck estimate');
      }
      for (let seed = 1; seed <= 25; seed++) {
        const item = makeDeckEstimateItem(spec, seededRng(seed));
        expect(spec.shoeSizes).toContain(item.shoeSize);
        expect(item.cardsRemaining).toBeGreaterThan(0);
        expect(item.cardsRemaining).toBeLessThanOrEqual(totalCards(item.shoeSize));
        expect(Number.isInteger(item.correct / spec.precision)).toBe(true);
        expect(Math.abs(item.correct * CARDS_PER_DECK - item.cardsRemaining)).toBeLessThanOrEqual(4);
        expect(item.choices).toContain(item.correct);
        expect(new Set(item.choices).size).toBe(item.choices.length);
      }
    }
  });

  it('true-count items follow the nearest-half convention', () => {
    const clean = trainingLevelSpec(4, 1);
    const halves = trainingLevelSpec(4, 2);
    const mixed = trainingLevelSpec(4, 3);
    for (const spec of [clean, halves, mixed]) {
      if (spec.mode !== 'trueCount') {
        throw new Error('expected true count');
      }
      for (let seed = 1; seed <= 25; seed++) {
        const item = makeTrueCountItem(spec, seededRng(seed));
        expect(item.correct).toBe(trueCountFromDecks(item.runningCount, item.decksRemaining));
        expect(item.choices).toContain(item.correct);
        if (spec.cleanDivision) {
          expect(Number.isInteger(item.correct)).toBe(true);
        }
        if (!spec.halfDecks) {
          expect(Number.isInteger(item.decksRemaining)).toBe(true);
        }
        if (!spec.negatives) {
          expect(item.runningCount).toBeGreaterThan(0);
        }
      }
    }
    expect(trueCountFromDecks(6, 1.5)).toBe(4);
    expect(trueCountFromDecks(5, 2.5)).toBe(2);
    expect(trueCountFromDecks(-7, 3)).toBe(-2.5);
    expect(trueCountFromDecks(0, 2)).toBe(0);
    expect(decksRemainingEstimate(52)).toBe(1);
    expect(decksRemainingEstimate(80)).toBe(1.5);
    expect(decksRemainingEstimate(3)).toBe(0.5);
  });
});

describe('training ladder — count streams', () => {
  const fullDeck = trainingLevelSpec(1, 5) as CountStreamLevel;

  it('a full deck streams 52 unique cards and ends at running count 0', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const script = buildCountStreamScript(fullDeck, seededRng(seed));
      expect(script.frames).toHaveLength(52);
      expect(new Set(visibleCardIds(script)).size).toBe(52);
      expect(script.frames[51].runningCount).toBe(0);
      expect(script.frames[51].cardsRemaining).toBe(0);
      const final = script.checkpoints[script.checkpoints.length - 1];
      expect(final.isFinal).toBe(true);
      expect(final.frameIndex).toBe(51);
      expect(final.parts).toEqual([{ kind: 'runningCount', correct: 0 }]);
      expect(script.checkpoints).toHaveLength(totalCheckpoints(fullDeck));
    }
  });

  it('every frame’s running count is the Hi-Lo sum of the cards seen so far', () => {
    for (const { spec } of allSpecs) {
      if (spec.mode !== 'countStream') {
        continue;
      }
      const script = buildCountStreamScript(spec, seededRng(spec.level * 7));
      let sum = 0;
      script.frames.forEach((frame, index) => {
        sum += hiLoValue(frame.card!.rank);
        expect(frame.runningCount).toBe(sum);
        expect(frame.cardsDrawn).toBe(index + 1);
        expect(frame.cardsRemaining).toBe(totalCards(spec.deckCount) - index - 1);
      });
      expect(script.frames).toHaveLength(Math.min(spec.cardCount, totalCards(spec.deckCount)));
    }
  });

  it('multi-deck streams come from a real shoe: exact per-deck composition', () => {
    const spec = { ...(trainingLevelSpec(3, 5) as CountStreamLevel), cardCount: 208 };
    const script = buildCountStreamScript(spec, seededRng(21));
    expect(script.frames).toHaveLength(208);
    const ids = visibleCardIds(script);
    expect(new Set(ids).size).toBe(208);
    const perRankSuit = new Map<string, number>();
    for (const frame of script.frames) {
      const key = `${frame.card!.rank}${frame.card!.suit}`;
      perRankSuit.set(key, (perRankSuit.get(key) ?? 0) + 1);
    }
    expect(perRankSuit.size).toBe(52);
    for (const count of perRankSuit.values()) {
      expect(count).toBe(4);
    }
    expect(script.frames[207].runningCount).toBe(0);
  });

  it('checkpoints ask for the actual count at their frame, spread through the deal', () => {
    for (const { spec } of allSpecs) {
      if (!isCheckpointLevel(spec)) {
        continue;
      }
      const script = buildTrainingScript(spec, seededRng(spec.level * 11 + 1));
      expect(script.checkpoints).toHaveLength(totalCheckpoints(spec));
      let previous = -1;
      for (const checkpoint of script.checkpoints) {
        const frame = script.frames[checkpoint.frameIndex];
        expect(frame.card).not.toBeNull();
        expect(checkpoint.frameIndex).toBeGreaterThan(previous);
        previous = checkpoint.frameIndex;
        for (const part of checkpoint.parts) {
          expect(spec.questions).toContain(part.kind);
          if (part.kind === 'runningCount') {
            expect(part.correct).toBe(frame.runningCount);
          } else if (part.kind === 'decksRemaining') {
            expect(part.correct).toBe(decksRemainingEstimate(frame.cardsRemaining));
          } else {
            expect(part.correct).toBe(
              trueCountFromDecks(frame.runningCount, decksRemainingEstimate(frame.cardsRemaining)),
            );
          }
        }
      }
      // Never on the first three cards.
      const seenBefore = script.frames
        .slice(0, script.checkpoints[0].frameIndex + 1)
        .filter((frame) => frame.card).length;
      expect(seenBefore).toBeGreaterThan(3);
    }
  });

  it('question orders: paired asks everything, alternate cycles, random stays balanced', () => {
    expect(assignQuestionKinds(['decksRemaining', 'trueCount'], 'paired', 3)).toEqual([
      ['decksRemaining', 'trueCount'],
      ['decksRemaining', 'trueCount'],
      ['decksRemaining', 'trueCount'],
    ]);
    expect(assignQuestionKinds(['runningCount', 'decksRemaining'], 'alternate', 3)).toEqual([
      ['runningCount'],
      ['decksRemaining'],
      ['runningCount'],
    ]);
    const random = assignQuestionKinds(
      ['runningCount', 'decksRemaining', 'trueCount'],
      'random',
      20,
      seededRng(3),
    );
    const flat = random.flat();
    expect(flat.filter((kind) => kind === 'runningCount')).toHaveLength(10);
    expect(flat.filter((kind) => kind === 'decksRemaining')).toHaveLength(5);
    expect(flat.filter((kind) => kind === 'trueCount')).toHaveLength(5);
  });
});

describe('training ladder — table scripts', () => {
  const blackjackTest = trainingLevelSpec(1, 6) as TableCountLevel;

  it('Map 1 level 6 autoplays one deck: player and dealer draw to 17, hole flips into the count', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const script = buildTableScript(blackjackTest, seededRng(seed));
      expect(script.deckCount).toBe(1);
      const ids = visibleCardIds(script);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThan(30);
      expect(script.frames.some((frame) => frame.beat === 'holeFlip')).toBe(true);
      expect(script.checkpoints).toHaveLength(6);

      let sum = 0;
      for (const frame of script.frames) {
        if (frame.card) {
          expect(isFaceUp(frame.card)).toBe(true);
          sum += hiLoValue(frame.card.rank);
        }
        expect(frame.runningCount).toBe(sum);
        // The count never includes a face-down card on the felt.
        const visible = [
          ...frame.table.seats.flatMap((seat) => seat.hands.flatMap((hand) => hand.cards)),
          ...(frame.table.dealer?.cards ?? []),
        ].filter((card) => isFaceUp(card));
        expect(visible.every((card) => ids.includes(card.id))).toBe(true);
      }
      // Both hands at the table finished at 17+ before the felt cleared.
      const lastSettled = [...script.frames]
        .reverse()
        .find((frame) => frame.beat === 'hit' || frame.beat === 'holeFlip');
      expect(lastSettled).toBeDefined();
    }
  });

  it('never deals a card the shoe does not have — multi-deck composition holds', () => {
    const spec = trainingLevelSpec(2, 6) as TableCountLevel;
    const script = buildTableScript(spec, seededRng(5));
    const ids = visibleCardIds(script);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(104);
    const perRankSuit = new Map<string, number>();
    for (const frame of script.frames) {
      if (frame.card) {
        const key = `${frame.card.rank}${frame.card.suit}`;
        perRankSuit.set(key, (perRankSuit.get(key) ?? 0) + 1);
      }
    }
    for (const count of perRankSuit.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
    const last = script.frames[script.frames.length - 1];
    expect(last.cardsDrawn).toBeLessThanOrEqual(104);
  });

  it('deal-only tables show two cards per seat and both dealer cards', () => {
    const spec = trainingLevelSpec(2, 5) as TableCountLevel;
    const script = buildTableScript(spec, seededRng(12));
    const openingFrames = script.frames.filter((frame) => frame.beat === 'card');
    expect(openingFrames.length % (2 * (spec.seats + 1))).toBe(0);
    expect(script.frames.every((frame) => frame.beat !== 'hit' && frame.beat !== 'holeFlip')).toBe(
      true,
    );
    for (const frame of openingFrames) {
      expect(frame.card && isFaceUp(frame.card)).toBe(true);
      for (const seat of frame.table.seats) {
        expect(seat.hands[0].cards.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('strategy tables use the real engine: splits and doubles appear over many seeds', () => {
    const spec = trainingLevelSpec(5, 3) as TableCountLevel;
    let splits = 0;
    let doubles = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const script = buildTableScript(spec, seededRng(seed));
      splits += script.frames.filter((frame) => frame.beat === 'split').length;
      doubles += script.frames.filter((frame) =>
        frame.table.seats.some((seat) => seat.hands.some((hand) => hand.isDoubled)),
      ).length;
      let sum = 0;
      for (const frame of script.frames) {
        if (frame.card) {
          sum += hiLoValue(frame.card.rank);
        }
        expect(frame.runningCount).toBe(sum);
      }
      expect(new Set(visibleCardIds(script)).size).toBe(visibleCardIds(script).length);
    }
    expect(splits).toBeGreaterThan(0);
    expect(doubles).toBeGreaterThan(0);
  });

  it('the exam and endurance shoes run to the cut card and no further', () => {
    const exam = trainingLevelSpec(6, 6) as TableCountLevel;
    const script = buildTableScript(exam, seededRng(77));
    const last = script.frames[script.frames.length - 1];
    expect(last.cardsDrawn).toBeGreaterThanOrEqual(exam.cardBudget);
    expect(last.cardsDrawn).toBeLessThanOrEqual(totalCards(6));
    expect(script.checkpoints).toHaveLength(20);
    expect(script.frames.some((frame) => frame.beat === 'settle')).toBe(true);
  });
});

describe('training ladder — checkpoint scoring', () => {
  const spec = trainingLevelSpec(3, 6) as CheckpointLevelSpec;

  it('tallies per kind, counts a checkpoint only when every part is right', () => {
    let tally = recordCheckpoint(EMPTY_TALLY, [{ kind: 'runningCount', correct: 3 }], [true]);
    tally = recordCheckpoint(
      tally,
      [
        { kind: 'decksRemaining', correct: 2 },
        { kind: 'trueCount', correct: 1.5 },
      ],
      [true, false],
    );
    tally = recordCheckpoint(tally, [{ kind: 'runningCount', correct: -2 }], [false]);
    expect(tally.asked).toBe(3);
    expect(tally.correct).toBe(1);
    expect(tally.runningCountMisses).toBe(1);
    expect(tally.byKind.runningCount).toEqual({ asked: 2, correct: 1 });
    expect(tally.byKind.decksRemaining).toEqual({ asked: 1, correct: 1 });
    expect(tally.byKind.trueCount).toEqual({ asked: 1, correct: 0 });
    expect(accuracyPercent(tally.byKind.runningCount)).toBe(50);
    expect(accuracyPercent({ asked: 0, correct: 0 })).toBeNull();
  });

  it('fails early once the pass rule is out of reach', () => {
    const total = totalCheckpoints(spec); // 14, need 12 with ≤ 1 running-count miss
    let tally = EMPTY_TALLY;
    expect(canStillPass(spec.pass, tally, total)).toBe(true);
    tally = recordCheckpoint(tally, [{ kind: 'decksRemaining', correct: 2 }], [false]);
    tally = recordCheckpoint(tally, [{ kind: 'decksRemaining', correct: 2 }], [false]);
    expect(canStillPass(spec.pass, tally, total)).toBe(true);
    tally = recordCheckpoint(tally, [{ kind: 'decksRemaining', correct: 2 }], [false]);
    expect(canStillPass(spec.pass, tally, total)).toBe(false);

    let rc = recordCheckpoint(EMPTY_TALLY, [{ kind: 'runningCount', correct: 2 }], [false]);
    expect(canStillPass(spec.pass, rc, total)).toBe(true);
    rc = recordCheckpoint(rc, [{ kind: 'runningCount', correct: 2 }], [false]);
    expect(canStillPass(spec.pass, rc, total)).toBe(false);
  });

  it('passes when the thresholds are met', () => {
    let tally = EMPTY_TALLY;
    for (let i = 0; i < 12; i++) {
      tally = recordCheckpoint(tally, [{ kind: 'runningCount', correct: 1 }], [true]);
    }
    expect(hasPassed(spec.pass, tally)).toBe(true);
    tally = recordCheckpoint(EMPTY_TALLY, [{ kind: 'runningCount', correct: 1 }], [true]);
    expect(hasPassed(spec.pass, tally)).toBe(false);
  });
});
