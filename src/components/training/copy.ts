import {
  CheckpointLevelSpec,
  decisionLabel,
  isCheckpointLevel,
  isMiniGame,
  isRoundsLevel,
  QuestionKind,
  ShoeRunLevel,
  STAR_COUNT,
  StarTargets,
  starTargets,
  totalCheckpoints,
  TrainingLevelSpec,
} from '../../engine/dojo';
import { formatCount } from '../../utils/countCoach';

/** "3", "3.5" — decks never carry a sign. */
export function formatDecks(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/** "1 unit", "3 units". */
export function formatUnits(value: number): string {
  return `${value} unit${value === 1 ? '' : 's'}`;
}

/** The answer as it reads for its question kind. */
export function formatAnswer(kind: QuestionKind, value: number): string {
  switch (kind) {
    case 'decksRemaining':
      return formatDecks(value);
    case 'betUnits':
      return formatUnits(value);
    case 'insurance':
      return decisionLabel(value);
    default:
      return formatCount(value);
  }
}

/** The question the pause asks. */
export function questionPrompt(kind: QuestionKind, isFinal: boolean): string {
  switch (kind) {
    case 'runningCount':
      return isFinal ? 'FINAL COUNT?' : 'WHAT’S THE RUNNING COUNT?';
    case 'decksRemaining':
      return 'HOW MANY DECKS REMAIN?';
    case 'trueCount':
      return 'WHAT’S THE TRUE COUNT?';
    case 'betUnits':
      return 'WHAT’S YOUR BET?';
    case 'insurance':
      return 'DEALER SHOWS AN ACE — INSURANCE?';
  }
}

/** Short label for a question kind — results and givens. */
export function kindLabel(kind: QuestionKind): string {
  switch (kind) {
    case 'runningCount':
      return 'Running count';
    case 'decksRemaining':
      return 'Decks remaining';
    case 'trueCount':
      return 'True count';
    case 'betUnits':
      return 'Bet';
    case 'insurance':
      return 'Insurance';
  }
}

/** "1 deck" / "6-deck shoe". */
export function deckLabel(deckCount: number): string {
  return deckCount === 1 ? '1 deck' : `${deckCount}-deck shoe`;
}

/** "★", "★★", "★★★". */
export function starGlyphs(stars: number): string {
  return '★'.repeat(Math.max(0, Math.min(STAR_COUNT, stars)));
}

/** What a level counts toward its stars, as a star tile says it: "grids", "rounds", "checks", "right". */
export function starUnit(spec: TrainingLevelSpec): string {
  if (isRoundsLevel(spec)) {
    return 'rounds';
  }
  return spec.mode === 'shoeRun' ? 'hands' : streakUnit(spec);
}

/** What a streak level counts toward its stars. */
function streakUnit(spec: TrainingLevelSpec): string {
  switch (spec.mode) {
    case 'cancelGrid':
    case 'divideMatch':
      return 'grids';
    case 'swipeStrategy':
    case 'chipRush':
    case 'busyTable':
      return spec.mode === 'busyTable' ? 'stages' : 'waves';
    case 'flipPoint':
      return 'sets';
  }
  if (isRoundsLevel(spec)) {
    return 'rounds right';
  }
  return isCheckpointLevel(spec) ? 'checks' : 'right';
}

/** "★ 11 · ★★ 21 · ★★★ 32 right" — the run's three stages. */
export function starTargetsLine(spec: TrainingLevelSpec, targets: StarTargets = starTargets(spec)): string {
  const stages = targets.map((target, index) => `${starGlyphs(index + 1)} ${target}`);
  return `${stages.join(' · ')} ${streakUnit(spec)}`;
}

/** "32 right earns ★★★." — what the stretch asks for. */
export function stretchLine(spec: TrainingLevelSpec, targets: StarTargets = starTargets(spec)): string {
  return `${targets[STAR_COUNT - 1]} ${streakUnit(spec)} earns ${starGlyphs(STAR_COUNT)}.`;
}

/** What carries into the stretch: the shoe (fresh for a deal) and the run's misses. */
export function stretchRulesLine(spec: TrainingLevelSpec): string {
  if (spec.mode === 'shoeRun') {
    return 'Same shoe.';
  }
  if (!isCheckpointLevel(spec)) {
    return spec.strikes === 0 ? 'A miss still ends the run.' : 'Strikes carry over.';
  }
  return missesAllowed(spec) === 0 ? 'Fresh shoe — a miss still ends the run.' : 'Fresh shoe — misses carry over.';
}

/** The boss's rules: its shoe, what is graded, and what clears it. */
export function shoeRunChips(spec: ShoeRunLevel): string[] {
  const graded = [
    spec.checks.length > 0 ? 'counts' : null,
    spec.betting ? 'bets' : null,
    spec.insurance ? 'insurance' : null,
    spec.indexPlays ? 'index plays' : null,
  ].filter(Boolean);
  const chips = [
    `${spec.hands} hands · ${deckLabel(spec.deckCount)}`,
    `Graded: ${graded.join(', ')}`,
    `${Math.round(spec.clearAccuracy * 100)}% right clears · ${Math.round(spec.perfectAccuracy * 100)}% for ★★★`,
  ];
  if (spec.checkTimeMs) {
    chips.push(`${Math.round(spec.checkTimeMs / 1000)} seconds per count call`);
  }
  if (spec.heat) {
    chips.push('Ramp too fast and the pit boss backs you off');
  }
  return chips;
}

/**
 * Bullets for the level brief: the star stages first, then the rules that
 * hold for the whole run.
 */
export function requirementChips(
  spec: TrainingLevelSpec,
  { starTargets: withStarTargets = true }: { readonly starTargets?: boolean } = {},
): string[] {
  const chips: string[] = withStarTargets ? [starTargetsLine(spec)] : [];
  if (spec.mode === 'shoeRun') {
    return shoeRunChips(spec);
  }
  if (!isCheckpointLevel(spec)) {
    chips.push(
      spec.strikes === 0
        ? 'A miss ends the run'
        : `${spec.strikes} strike${spec.strikes === 1 ? '' : 's'}, then out`,
    );
    if (spec.mode === 'cancelGrid') {
      chips.push('The meter drains while the grid is up');
    } else if (isMiniGame(spec)) {
      chips.push('The meter drains while you play');
    }
    return chips;
  }
  if (isRoundsLevel(spec)) {
    const rounds = spec.rounds;
    chips.push(`${spec.pass.minCorrect} of ${rounds.count} rounds right clears`);
    chips.push(`A fresh deck each round · stops at card ${rounds.minCards}–${rounds.maxCards}`);
    chips.push('Exact entry · the meter drains while you answer');
    return chips;
  }
  const total = totalCheckpoints(spec);
  const allowed = missesAllowed(spec);
  if (allowed === 0) {
    chips.push('A miss ends the run');
  } else {
    chips.push(`${allowed} miss${allowed === 1 ? '' : 'es'}, then out`);
    if (spec.pass.maxRunningCountMisses < total - spec.pass.minCorrect) {
      chips.push(
        spec.pass.maxRunningCountMisses === 0
          ? 'No running-count misses'
          : `≤ ${spec.pass.maxRunningCountMisses} running-count miss`,
      );
    }
  }
  chips.push(
    spec.mode === 'countStream' && spec.presentation === 'rain'
      ? `A check every ${spec.checkGap?.min ?? 5}–${spec.checkGap?.max ?? 10} cards`
      : deckLabel(spec.deckCount),
  );
  if (spec.mode === 'countStream' && spec.timed) {
    chips.push('The meter drains while you answer');
  }
  if (spec.mode === 'tableCount') {
    chips.push(spec.seats === 1 ? 'You vs. the dealer' : `${spec.seats} players + dealer`);
  }
  if (spec.answerInput === 'entry') {
    chips.push('Exact entry');
  }
  return chips;
}

/** Misses the pass rule still tolerates overall. */
export function missesAllowed(spec: CheckpointLevelSpec): number {
  return Math.max(0, totalCheckpoints(spec) - spec.pass.minCorrect);
}

// ---------------------------------------------------------------------------
// The brief's rules as stat tiles
// ---------------------------------------------------------------------------

export type RuleIcon = 'timer' | 'keypad' | 'players' | 'flame';

/** One stat tile: a big value (or an icon) over a small label — "2 / MISSES ALLOWED". */
export interface RuleTile {
  readonly value: string;
  readonly icon?: RuleIcon;
  readonly label: string;
}

export interface RuleTiles {
  readonly tiles: readonly RuleTile[];
  /** Fine print under the row — what is graded, the odd extra rule. */
  readonly note?: string;
}

const TIMED_TILE: RuleTile = { value: '', icon: 'timer', label: 'timed answer' };
const ENTRY_TILE: RuleTile = { value: '', icon: 'keypad', label: 'exact entry' };

function deckTile(deckCount: number): RuleTile {
  return { value: `${deckCount}`, label: deckCount === 1 ? 'deck' : 'decks' };
}

/** The shoe run's rules: its length and shoe, the clock, the boss's strikes and heat; what is graded as the note. */
export function shoeRunTiles(spec: ShoeRunLevel): RuleTiles {
  const tiles: RuleTile[] = [{ value: `${spec.hands}`, label: 'hands' }, deckTile(spec.deckCount)];
  if (spec.checkTimeMs) {
    tiles.push({ value: `${Math.round(spec.checkTimeMs / 1000)}s`, label: 'per count call' });
  }
  if (spec.maxMoveMisses != null && spec.maxCountMisses != null) {
    tiles.push({ value: `${spec.maxMoveMisses + 1}+${spec.maxCountMisses + 1}`, label: 'move / count strikes' });
  }
  if (spec.heat) {
    tiles.push({ value: '', icon: 'flame', label: 'pit boss watches' });
  }
  const graded = [
    spec.checks.length > 0 ? 'counts' : null,
    spec.betting ? 'bets' : null,
    spec.insurance ? 'insurance' : null,
    spec.indexPlays ? 'index plays' : null,
  ].filter(Boolean);
  const notes = [`Graded: ${graded.join(', ')}`];
  if (spec.heat) {
    notes.push('ramp too fast and the pit boss backs you off');
  }
  return { tiles, note: notes.join(' · ') };
}

/** The shoe run's star tiles: one for seeing it through, two at the pass mark, three at the perfect mark. */
export function shoeRunStarLabels(spec: ShoeRunLevel): readonly [string, string, string] {
  return [
    'finish',
    `${Math.round(spec.clearAccuracy * 100)}% right`,
    `${Math.round(spec.perfectAccuracy * 100)}% right`,
  ];
}

/**
 * The level brief's rules as one row of stat tiles — the same facts as
 * `requirementChips` (minus the star line, which the star goals carry) in a
 * quarter of the height. Numbers go big, words go small, the timer and keypad
 * become icons.
 */
export function requirementTiles(spec: TrainingLevelSpec): RuleTiles {
  if (spec.mode === 'shoeRun') {
    return shoeRunTiles(spec);
  }
  if (!isCheckpointLevel(spec)) {
    const tiles: RuleTile[] = [
      spec.strikes === 0
        ? { value: '0', label: 'misses allowed' }
        : { value: `${spec.strikes}`, label: spec.strikes === 1 ? 'strike' : 'strikes' },
    ];
    if (spec.mode === 'cancelGrid') {
      tiles.push({ value: '', icon: 'timer', label: 'meter runs with the grid up' });
    } else if (isMiniGame(spec)) {
      tiles.push({ value: '', icon: 'timer', label: 'meter runs while you play' });
    }
    return { tiles };
  }
  if (isRoundsLevel(spec)) {
    const rounds = spec.rounds;
    return {
      tiles: [
        { value: `${spec.pass.minCorrect} / ${rounds.count}`, label: 'rounds to clear' },
        { value: `${rounds.minCards}–${rounds.maxCards}`, label: 'stops at card' },
        TIMED_TILE,
        ENTRY_TILE,
      ],
      note: 'A fresh deck each round',
    };
  }
  const total = totalCheckpoints(spec);
  const allowed = missesAllowed(spec);
  const tiles: RuleTile[] = [{ value: `${allowed}`, label: allowed === 1 ? 'miss allowed' : 'misses allowed' }];
  const notes: string[] = [];
  if (allowed > 0 && spec.pass.maxRunningCountMisses < total - spec.pass.minCorrect) {
    notes.push(
      spec.pass.maxRunningCountMisses === 0
        ? 'No running-count misses'
        : `At most ${spec.pass.maxRunningCountMisses} running-count miss${spec.pass.maxRunningCountMisses === 1 ? '' : 'es'}`,
    );
  }
  if (spec.mode === 'countStream' && spec.presentation === 'rain') {
    tiles.push({ value: `${spec.checkGap?.min ?? 5}–${spec.checkGap?.max ?? 10}`, label: 'cards a check' });
  } else {
    tiles.push(deckTile(spec.deckCount));
  }
  if (spec.mode === 'tableCount') {
    tiles.push({
      value: '',
      icon: 'players',
      label: spec.seats === 1 ? 'you vs. the dealer' : `${spec.seats} players + dealer`,
    });
  }
  if (spec.mode === 'countStream' && spec.timed) {
    tiles.push(TIMED_TILE);
  }
  if (spec.answerInput === 'entry') {
    tiles.push(ENTRY_TILE);
  }
  return { tiles, note: notes.length > 0 ? notes.join(' · ') : undefined };
}
