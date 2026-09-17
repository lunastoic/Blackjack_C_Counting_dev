import {
  CheckpointLevelSpec,
  isCheckpointLevel,
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

/** What a streak level counts toward its stars. */
function streakUnit(spec: TrainingLevelSpec): string {
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
  chips.push(deckLabel(spec.deckCount));
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
