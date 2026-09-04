import {
  CheckpointLevelSpec,
  isCheckpointLevel,
  QuestionKind,
  totalCheckpoints,
  TrainingLevelSpec,
} from '../../engine/dojo';
import { formatCount } from '../../utils/countCoach';

/** "3", "3.5" — decks never carry a sign. */
export function formatDecks(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/** The answer as it reads for its question kind. */
export function formatAnswer(kind: QuestionKind, value: number): string {
  return kind === 'decksRemaining' ? formatDecks(value) : formatCount(value);
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
  }
}

/** "1 deck" / "6-deck shoe". */
export function deckLabel(deckCount: number): string {
  return deckCount === 1 ? '1 deck' : `${deckCount}-deck shoe`;
}

/** Bullets for the level brief: what it takes to clear the level. */
export function requirementChips(spec: TrainingLevelSpec): string[] {
  if (!isCheckpointLevel(spec)) {
    return [`${spec.streakTarget} in a row`, 'A miss resets the streak'];
  }
  const total = totalCheckpoints(spec);
  const chips: string[] = [];
  if (spec.pass.minCorrect >= total) {
    chips.push(`${total} checks · all correct`);
  } else {
    chips.push(`${spec.pass.minCorrect} of ${total} checks`);
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
