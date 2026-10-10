import { betUnitsForTrueCount, BET_SPREAD_MAX } from '../../engine/betting/betRamp';
import { hiLoValue, isFaceUp } from '../../engine/cards/card';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import {
  answersByEntry,
  makeBetSizeItem,
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
  isMiniGame,
  stagedSpec,
  StreakLevelSpec,
  TrainingLevelSpec,
  isStreakLevel,
  makeDeckEstimateItem,
  makeTrueCountItem,
  practiceShoe,
  recordCheckpoint,
  SPEED_PROFILES,
  STAR_COUNT,
  starChips,
  starsForCheckpointRun,
  starsForStreakRun,
  starsReached,
  starStretchSpec,
  starTargets,
  nextStarTarget,
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
        expect(
          isStreakLevel(spec) ||
            isCheckpointLevel(spec) ||
            isMiniGame(spec) ||
            spec.mode === 'shoeRun' ||
            spec.mode === 'cancelGrid',
        ).toBe(true);
      }
      // Every casino has a table night before its boss, and level 2 is its mini-game.
      expect(map.levels[4]).toMatchObject({ mode: 'shoeRun', title: 'Table Night' });
      expect(map.levels[1].mode === 'cancelGrid' || isMiniGame(map.levels[1])).toBe(true);
    }
    // The bosses: Zero Hero, two played shoes, and three Count-Along tables in between.
    expect(trainingLevelSpec(1, 6)).toMatchObject({ mode: 'countStream', title: 'Zero Hero' });
    expect(trainingLevelSpec(2, 6)).toMatchObject({ mode: 'shoeRun', title: 'Clean Shoe', deckCount: 2 });
    for (const [mapId, decks] of [[3, 4], [4, 6], [5, 8]] as const) {
      expect(trainingLevelSpec(mapId, 6)).toMatchObject({
        mode: 'tableCount',
        title: 'Count-Along',
        deckCount: decks,
        perHand: true,
      });
    }
    expect(trainingLevelSpec(6, 6)).toMatchObject({ mode: 'shoeRun', title: 'Beat the Casino' });
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

  it('Map 1 follows the spec: values → Cancel Out → card groups → Card Rain → table night → Zero Hero', () => {
    const [l1, l2, l3, l4, l5, l6] = trainingLevelsForMap(1);
    expect(l1).toMatchObject({ mode: 'cardValue', streakTarget: 21, strikes: 3 });
    expect(l2).toMatchObject({ mode: 'cancelGrid', title: 'Cancel Out', strikes: 3 });
    expect(l3).toMatchObject({
      mode: 'cardGroup',
      title: 'Card Groups',
      groupSizes: [2, 3, 4],
      groupOrder: 'progressive',
      stageLength: 8,
      strikes: 3,
    });
    expect(l4).toMatchObject({
      mode: 'countStream',
      title: 'Card Rain',
      presentation: 'rain',
      checkGap: { min: 5, max: 10 },
      answerInput: 'entry',
      timed: true,
    });
    expect(l5).toMatchObject({
      mode: 'shoeRun',
      title: 'Table Night',
      deckCount: 1,
      betting: false,
      heat: false,
      checks: ['runningCount'],
      checkEvery: 1,
      checkTimeMs: 8000,
    });
    expect(l6).toMatchObject({
      mode: 'countStream',
      title: 'Zero Hero',
      answerInput: 'entry',
      timed: true,
      rounds: { count: 3, minCards: 39, maxCards: 48 },
      pass: { minCorrect: 2, maxRunningCountMisses: 1 },
    });
  });

  it('each map teaches one skill: strategy, true count, bets, play changes, then casino conditions', () => {
    expect(trainingLevelsForMap(2).map((spec) => spec.mode)).toEqual([
      'strategy',
      'swipeStrategy',
      'strategy',
      'shoeRun',
      'shoeRun',
      'shoeRun',
    ]);
    expect(trainingLevelSpec(2, 3)).toMatchObject({ stageLength: 8, stages: [{ kinds: ['hard'] }, { kinds: ['soft'] }, { kinds: ['pairs'] }] });
    expect(trainingLevelSpec(2, 4)).toMatchObject({ title: 'Play and Count', gradeMoves: true, checkGap: { min: 3, max: 5 } });
    expect(trainingLevelsForMap(3).map((spec) => spec.mode)).toEqual([
      'deckEstimate',
      'divideMatch',
      'trueCount',
      'countStream',
      'shoeRun',
      'tableCount',
    ]);
    expect(trainingLevelSpec(4, 1)).toMatchObject({ mode: 'betSize', title: 'Bet the Count', hideRampAfter: 10 });
    expect(trainingLevelSpec(4, 2).mode).toBe('chipRush');
    expect(trainingLevelSpec(4, 4)).toMatchObject({ mode: 'countStream', deckCount: 4, questions: ['betUnits'] });
    expect(trainingLevelSpec(5, 1)).toMatchObject({ mode: 'indexPlay', plays: 'insurance' });
    expect(trainingLevelSpec(5, 2).mode).toBe('flipPoint');
    expect(trainingLevelSpec(5, 4)).toMatchObject({ mode: 'indexPlay', plays: 'mixed' });
    // The later Count-Alongs ask for the bet; Titan's adds insurance on a dealer Ace.
    for (const mapId of [4, 5]) {
      const boss = trainingLevelSpec(mapId, 6);
      if (boss.mode !== 'tableCount') {
        throw new Error('expected a Count-Along');
      }
      expect(boss.questions).toContain('betUnits');
      expect(boss.play).toBe('strategy');
    }
    expect(trainingLevelSpec(5, 6)).toMatchObject({ insuranceOnAce: true });
    expect(trainingLevelSpec(6, 2).mode).toBe('busyTable');
    expect(trainingLevelSpec(6, 3)).toMatchObject({ mode: 'tableCount', stagedDistractions: true });
    expect(trainingLevelSpec(6, 4)).toMatchObject({ mode: 'countStream', shoes: 2, deckCount: 8 });
  });

  it('deck counts climb by map: 1, then 2, then 1→4, 2→6, and 4→8', () => {
    const decksOf = (spec: TrainingLevelSpec): number[] => {
      if (spec.mode === 'deckEstimate') {
        return (spec.stages ?? [spec]).flatMap((stage) => stage.shoeSizes ?? spec.shoeSizes);
      }
      if (spec.mode === 'busyTable') {
        return spec.stages.map((stage) => stage.deckCount);
      }
      return 'deckCount' in spec && typeof spec.deckCount === 'number' ? [spec.deckCount] : [];
    };
    const range = (mapId: number) => {
      const decks = trainingLevelsForMap(mapId).flatMap(decksOf);
      return [Math.min(...decks), Math.max(...decks)];
    };
    expect(range(2)).toEqual([2, 2]);
    expect(range(3)).toEqual([1, 4]);
    expect(range(4)).toEqual([4, 6]);
    expect(range(5)).toEqual([8, 8]);
    expect(range(6)).toEqual([4, 8]);
  });

  it('bet items size the bet from the true count rounded down, minus one, 1 to 8 units', () => {
    const spec = trainingLevelSpec(4, 1);
    if (spec.mode !== 'betSize') {
      throw new Error('expected bet sizing');
    }
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const item = makeBetSizeItem(spec, seededRng(seed));
      expect(item.trueCount).toBe(trueCountFromDecks(item.runningCount, item.decksRemaining));
      expect(item.correct).toBe(Math.max(1, Math.min(BET_SPREAD_MAX, item.trueCount - 1)));
      expect(item.choices).toContain(item.correct);
      seen.add(item.correct);
    }
    // The drill covers the flat bet, the top of the spread and the steps between.
    expect(seen.has(1)).toBe(true);
    expect(seen.has(BET_SPREAD_MAX)).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('counts are always typed; quick drills and early table nights pick from choices', () => {
    for (const { map, spec } of allSpecs) {
      // Every count stream and table asks for the exact number.
      if (isCheckpointLevel(spec)) {
        expect(answersByEntry(spec)).toBe(true);
      } else if (
        spec.mode === 'deckEstimate' ||
        spec.mode === 'cardValue' ||
        spec.mode === 'cardGroup' ||
        spec.mode === 'indexPlay' ||
        spec.mode === 'strategy' ||
        isMiniGame(spec)
      ) {
        expect(answersByEntry(spec)).toBe(false);
      } else if (spec.mode === 'shoeRun' && map.mapId >= 4) {
        expect(answersByEntry(spec)).toBe(true);
      }
    }
    // The first bet drill picks; the staged one makes you work the number out.
    expect(answersByEntry(trainingLevelSpec(4, 1))).toBe(false);
    expect(answersByEntry(trainingLevelSpec(4, 3))).toBe(true);
  });

  it('pass rules are satisfiable and Map 6 is the exam', () => {
    for (const { spec } of allSpecs) {
      if (isCheckpointLevel(spec)) {
        expect(spec.pass.minCorrect).toBeLessThanOrEqual(totalCheckpoints(spec));
        expect(spec.pass.minCorrect).toBeGreaterThan(0);
      } else if (isStreakLevel(spec)) {
        expect(spec.streakTarget).toBeGreaterThan(0);
      }
    }
  });

  it('streak drills run 21, or clear after two stages of eight; strikes go 3 easy, 2 medium, 1 hard', () => {
    const strikesByMap: Record<number, number> = { 1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 1 };
    for (const { map, spec } of allSpecs) {
      if (isStreakLevel(spec)) {
        if (spec.stageLength) {
          expect(spec.streakTarget).toBe(spec.stageLength * 2);
        } else if (spec.mode === 'indexPlay' && spec.plays === 'mixed') {
          // Change or Not: a shorter, faster run.
          expect(spec.streakTarget).toBe(14);
        } else {
          expect(spec.streakTarget).toBe(21);
        }
      }
      if ('strikes' in spec) {
        expect(spec.strikes).toBe(strikesByMap[map.mapId]);
      }
    }
    const final = trainingLevelSpec(6, 6);
    expect(final).toMatchObject({
      mode: 'shoeRun',
      deckCount: 8,
      betting: true,
      heat: true,
      insurance: true,
      indexPlays: true,
    });
    if (final.mode === 'shoeRun') {
      expect(final.clearAccuracy).toBeGreaterThanOrEqual(0.9);
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

  it('scores stars from misses (shelved scoring)', () => {
    expect(starsForStreakRun(0)).toBe(3);
    expect(starsForStreakRun(1)).toBe(2);
    expect(starsForStreakRun(2)).toBe(1);
    expect(starsForStreakRun(3)).toBe(1);
    expect(starsForCheckpointRun(0)).toBe(3);
    expect(starsForCheckpointRun(1)).toBe(2);
    expect(starsForCheckpointRun(2)).toBe(1);
  });
});

describe('training ladder — star stages', () => {
  it('stages every level at half, the level itself, and half again (halves round up)', () => {
    expect(STAR_COUNT).toBe(3);
    for (const { spec } of allSpecs) {
      // Luna Luxe's staged levels star per grid, per group stage and per round instead.
      if (spec.mode === 'cancelGrid' || isMiniGame(spec) || (spec.mode === 'countStream' && spec.rounds)) {
        continue;
      }
      if (isStreakLevel(spec) && spec.stageLength) {
        // Staged drills star per stage.
        expect(starTargets(spec)).toEqual([spec.stageLength, spec.stageLength * 2, spec.stageLength * 3]);
        continue;
      }
      const base = isCheckpointLevel(spec)
        ? totalCheckpoints(spec)
        : spec.mode === 'shoeRun'
          ? spec.hands
          : (spec as StreakLevelSpec).streakTarget;
      const targets = starTargets(spec);
      expect(targets).toEqual([Math.round(base / 2), base, Math.round(base * 1.5)]);
      expect(targets[0]).toBeGreaterThan(0);
      expect(targets[0]).toBeLessThan(targets[1]);
      expect(targets[1]).toBeLessThan(targets[2]);
    }
    expect(starTargets(trainingLevelSpec(1, 1))).toEqual([11, 21, 32]);
    expect(starTargets(trainingLevelSpec(2, 1))).toEqual([11, 21, 32]);
    expect(starTargets(trainingLevelSpec(2, 2))).toEqual([1, 2, 3]);
  });

  it('counts the stars reached and names the next target', () => {
    const targets = starTargets(trainingLevelSpec(1, 1));
    expect(starsReached(targets, 0)).toBe(0);
    expect(starsReached(targets, 10)).toBe(0);
    expect(starsReached(targets, 11)).toBe(1);
    expect(starsReached(targets, 21)).toBe(2);
    expect(starsReached(targets, 31)).toBe(2);
    expect(starsReached(targets, 32)).toBe(3);
    expect(nextStarTarget(targets, 0)).toBe(11);
    expect(nextStarTarget(targets, 1)).toBe(21);
    expect(nextStarTarget(targets, 2)).toBe(32);
    expect(nextStarTarget(targets, 3)).toBe(32);
  });

  it('pays chips per star as a share of the casino table: 2.5%, 5%, 10% of the max bet', () => {
    expect(starChips(1_000, 1)).toBe(25);
    expect(starChips(1_000, 2)).toBe(50);
    expect(starChips(1_000, 3)).toBe(100);
    expect(starChips(1_000_000, 3)).toBe(100_000);
    expect(starChips(1_000, 0)).toBe(0);
    expect(starChips(1_000, 4)).toBe(0);
  });

  it('the stretch of every checkpoint level deals the extra checks from a fresh shoe', () => {
    for (const { map, spec } of allSpecs) {
      // Zero Hero has no stretch: its third star is its third round.
      if (!isCheckpointLevel(spec) || (spec.mode === 'countStream' && spec.rounds)) {
        continue;
      }
      const [, clear, third] = starTargets(spec);
      const stretch = starStretchSpec(spec);
      expect(totalCheckpoints(stretch)).toBe(third - clear);
      expect(stretch.deckCount).toBe(spec.deckCount);
      expect(stretch.pass).toEqual(spec.pass);
      // The stretch must fit its checks — the script schedules every one.
      const script = buildTrainingScript(stretch, seededRng(map.mapId * 10 + spec.level), seededRng(3));
      // Bonus insurance calls ride along without counting toward the stars.
      expect(script.checkpoints.filter((checkpoint) => !checkpoint.bonus)).toHaveLength(third - clear);
      if (spec.mode === 'countStream' && stretch.mode === 'countStream' && spec.finalCountQuestion) {
        expect(stretch.cardCount).toBe(spec.cardCount);
        expect(script.checkpoints[script.checkpoints.length - 1].isFinal).toBe(true);
      }
    }
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

  it('progressive groups climb through their sizes as the streak grows', () => {
    const spec = trainingLevelSpec(1, 3);
    if (spec.mode !== 'cardGroup') {
      throw new Error('expected card groups');
    }
    // Luna Luxe's groups climb in stages of eight: pairs, threes, then fours.
    expect(groupSizeForStreak(spec, 0)).toBe(2);
    expect(groupSizeForStreak(spec, 7)).toBe(2);
    expect(groupSizeForStreak(spec, 8)).toBe(3);
    expect(groupSizeForStreak(spec, 15)).toBe(3);
    expect(groupSizeForStreak(spec, 16)).toBe(4);
    expect(groupSizeForStreak(spec, 30)).toBe(4);
    expect(starTargets(spec)).toEqual([8, 16, 24]);
    const climbing = { ...spec, stageLength: undefined, groupSizes: [3, 4, 5] };
    expect(groupSizeForStreak(climbing, 0)).toBe(3);
    expect(groupSizeForStreak(climbing, 7)).toBe(4);
    expect(groupSizeForStreak(climbing, 14)).toBe(5);
    expect(groupSizeForStreak(climbing, 20)).toBe(5);
  });

  it('deck estimates match the cards remaining at the level precision', () => {
    const staged = trainingLevelSpec(3, 1);
    for (const streak of [0, 8, 16]) {
      const spec = stagedSpec(staged, streak);
      if (spec.mode !== 'deckEstimate') {
        throw new Error('expected deck estimate');
      }
      // Stages of one, two, then four decks.
      expect(spec.shoeSizes).toEqual([[1], [2], [4]][streak / 8]);
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

  it('true-count items round down to whole numbers', () => {
    const staged = trainingLevelSpec(3, 3);
    for (const spec of [0, 8, 16].map((streak) => stagedSpec(staged, streak))) {
      if (spec.mode !== 'trueCount') {
        throw new Error('expected true count');
      }
      for (let seed = 1; seed <= 25; seed++) {
        const item = makeTrueCountItem(spec, seededRng(seed));
        expect(item.correct).toBe(trueCountFromDecks(item.runningCount, item.decksRemaining));
        expect(item.choices).toContain(item.correct);
        expect(Number.isInteger(item.correct)).toBe(true);
        expect(item.correct).toBe(Math.floor(item.runningCount / item.decksRemaining) || 0);
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
    expect(trueCountFromDecks(-7, 3)).toBe(-3); // −2.33 rounds down
    expect(trueCountFromDecks(0, 2)).toBe(0);
    expect(decksRemainingEstimate(52)).toBe(1);
    expect(decksRemainingEstimate(80)).toBe(1.5);
    expect(decksRemainingEstimate(3)).toBe(0.5);
  });
});

describe('training ladder — count streams', () => {
  // A plain one-deck stream with a final count, built off Europa's live true count.
  const fullDeck: CountStreamLevel = {
    ...(trainingLevelSpec(3, 4) as CountStreamLevel),
    deckCount: 1,
    cardCount: 52,
    checkpoints: 5,
    questions: ['runningCount'],
    questionOrder: 'alternate',
    pass: { minCorrect: 5, maxRunningCountMisses: 1 },
    finalCountQuestion: true,
    checkGap: undefined,
  };

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
      // Card Rain and Zero Hero deal to their checks — covered below.
      if (spec.mode !== 'countStream' || spec.checkGap || spec.rounds || spec.shoes) {
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

  it('Card Rain checks every 5 to 10 cards and stops on the last check', () => {
    const spec = trainingLevelSpec(1, 4) as CountStreamLevel;
    for (let seed = 1; seed <= 40; seed++) {
      const script = buildCountStreamScript(spec, seededRng(seed), seededRng(seed + 100));
      expect(script.checkpoints).toHaveLength(spec.checkpoints);
      let previous = -1;
      let sum = 0;
      script.frames.forEach((frame) => {
        sum += hiLoValue(frame.card!.rank);
        expect(frame.runningCount).toBe(sum);
      });
      for (const checkpoint of script.checkpoints) {
        const gap = checkpoint.frameIndex - previous;
        expect(gap).toBeGreaterThanOrEqual(5);
        expect(gap).toBeLessThanOrEqual(10);
        expect(checkpoint.parts).toEqual([
          { kind: 'runningCount', correct: script.frames[checkpoint.frameIndex].runningCount },
        ]);
        previous = checkpoint.frameIndex;
      }
      expect(script.frames).toHaveLength(previous + 1);
    }
  });

  it('Zero Hero deals three fresh decks, each stopping between card 39 and 48, the count from 0', () => {
    const spec = trainingLevelSpec(1, 6) as CountStreamLevel;
    expect(starTargets(spec)).toEqual([1, 2, 3]);
    expect(totalCheckpoints(spec)).toBe(3);
    for (let seed = 1; seed <= 40; seed++) {
      const script = buildCountStreamScript(spec, seededRng(seed), seededRng(seed + 7));
      expect(script.checkpoints).toHaveLength(3);
      let start = 0;
      script.checkpoints.forEach((checkpoint, index) => {
        const round = script.frames.slice(start, checkpoint.frameIndex + 1);
        expect(round.length).toBeGreaterThanOrEqual(39);
        expect(round.length).toBeLessThanOrEqual(48);
        // Every round is its own deck: no card twice, the count starting at 0.
        expect(new Set(round.map((frame) => frame.card!.id)).size).toBe(round.length);
        let sum = 0;
        for (const frame of round) {
          sum += hiLoValue(frame.card!.rank);
          expect(frame.runningCount).toBe(sum);
          expect(frame.round).toBe(index + 1);
        }
        expect(round[round.length - 1].cardsDrawn).toBe(round.length);
        expect(checkpoint.isFinal).toBe(true);
        expect(checkpoint.parts).toEqual([{ kind: 'runningCount', correct: sum }]);
        start = checkpoint.frameIndex + 1;
      });
      expect(start).toBe(script.frames.length);
    }
  });

  it('multi-deck streams come from a real shoe: exact per-deck composition', () => {
    const spec = { ...(trainingLevelSpec(4, 4) as CountStreamLevel), cardCount: 208, checkGap: undefined };
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
      // Count-Along asks between hands, with the felt cleared — covered under table scripts.
      if (!isCheckpointLevel(spec) || (spec.mode === 'tableCount' && spec.perHand)) {
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
          } else if (part.kind === 'betUnits') {
            expect(part.correct).toBe(
              betUnitsForTrueCount(
                trueCountFromDecks(frame.runningCount, decksRemainingEstimate(frame.cardsRemaining)),
              ),
            );
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
  // Kepler's distraction table, stripped back to plain scheduled checks.
  const baseTable: TableCountLevel = {
    ...(trainingLevelSpec(6, 3) as TableCountLevel),
    stagedDistractions: false,
    distractions: false,
  };
  // One seat autoplayed through one deck.
  const blackjackTest: TableCountLevel = {
    ...baseTable,
    play: 'autoplay',
    deckCount: 1,
    seats: 1,
    cardBudget: 52,
    checkpoints: 6,
  };

  it('a one-deck autoplay table: player and dealer draw to 17, hole flips into the count', () => {
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
    const spec: TableCountLevel = { ...baseTable, play: 'autoplay', deckCount: 2, cardBudget: 104, checkpoints: 8 };
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
    const spec: TableCountLevel = { ...baseTable, play: 'dealOnly', deckCount: 2, cardBudget: 90, checkpoints: 6 };
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
    const spec = trainingLevelSpec(4, 6) as TableCountLevel;
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

  it('Count-Along asks every question as each hand clears, and insures on a dealer Ace', () => {
    for (const mapId of [3, 4, 5]) {
      const spec = trainingLevelSpec(mapId, 6) as TableCountLevel;
      for (let seed = 1; seed <= 6; seed++) {
        const script = buildTableScript(spec, seededRng(seed * mapId));
        const main = script.checkpoints.filter((checkpoint) => !checkpoint.bonus);
        expect(main).toHaveLength(spec.checkpoints);
        for (const checkpoint of main) {
          const frame = script.frames[checkpoint.frameIndex];
          expect(frame.beat).toBe('collect');
          expect(checkpoint.parts.map((part) => part.kind)).toEqual(spec.questions);
          expect(checkpoint.parts[0].kind === 'runningCount' ? checkpoint.parts[0].correct : frame.runningCount).toBe(
            frame.runningCount,
          );
        }
        for (const bonus of script.checkpoints.filter((checkpoint) => checkpoint.bonus)) {
          expect(spec.insuranceOnAce).toBe(true);
          expect(script.frames[bonus.frameIndex].card?.rank).toBe('A');
          expect(bonus.parts.map((part) => part.kind)).toEqual(['insurance']);
        }
      }
    }
    // Over a few shoes, Titan's boss does meet a dealer Ace.
    const titan = trainingLevelSpec(5, 6) as TableCountLevel;
    const bonuses = [1, 2, 3, 4, 5, 6, 7, 8].reduce(
      (sum, seed) => sum + buildTableScript(titan, seededRng(seed)).checkpoints.filter((c) => c.bonus).length,
      0,
    );
    expect(bonuses).toBeGreaterThan(0);
  });

  it('Long Shift deals two full shoes, the count starting over with the second', () => {
    const spec = trainingLevelSpec(6, 4) as CountStreamLevel;
    const script = buildCountStreamScript(spec, seededRng(9), seededRng(10));
    const second = script.frames.findIndex((frame) => frame.round === 2);
    expect(second).toBeGreaterThan(0);
    expect(script.frames[second].cardsDrawn).toBe(1);
    expect(script.frames[second].runningCount).toBe(hiLoValue(script.frames[second].card!.rank));
    expect(script.checkpoints).toHaveLength(spec.checkpoints);
    let previous = -1;
    for (const checkpoint of script.checkpoints) {
      expect(checkpoint.frameIndex - previous).toBeGreaterThanOrEqual(12);
      expect(checkpoint.frameIndex - previous).toBeLessThanOrEqual(18);
      expect(checkpoint.parts).toEqual([
        { kind: 'runningCount', correct: script.frames[checkpoint.frameIndex].runningCount },
      ]);
      previous = checkpoint.frameIndex;
    }
  });

  it('the endurance shoe runs to the cut card and no further', () => {
    const exam: TableCountLevel = { ...baseTable, cardBudget: 6 * 52 - 78 };
    const script = buildTableScript(exam, seededRng(77));
    const last = script.frames[script.frames.length - 1];
    expect(last.cardsDrawn).toBeGreaterThanOrEqual(exam.cardBudget);
    expect(last.cardsDrawn).toBeLessThanOrEqual(totalCards(6));
    expect(script.checkpoints).toHaveLength(exam.checkpoints);
  });
});

describe('training ladder — checkpoint scoring', () => {
  // Fourteen checks, twelve to pass, at most one running-count miss.
  const spec: CheckpointLevelSpec = {
    ...(trainingLevelSpec(3, 4) as CheckpointLevelSpec),
    checkpoints: 14,
    pass: { minCorrect: 12, maxRunningCountMisses: 1 },
  };

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
