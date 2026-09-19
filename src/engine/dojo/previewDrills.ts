import { PreviewDrillId } from './rewards';
import { ShoeRunLevel, TrainingLevelSpec } from './training';

/**
 * The drills the money bags carry: a short taste of the next casino's skill,
 * played from the trail. They keep the shape of the levels they preview but
 * ask for less, and they bank nothing — no stars, no strikes, no chips.
 */

const PREVIEW_STREAK = 10;
const PREVIEW_STRIKES = 2;

export const PREVIEW_DRILL_SPECS: Readonly<Record<PreviewDrillId, TrainingLevelSpec>> = {
  deckCountdown: {
    mode: 'countStream',
    level: 0,
    title: 'Deck Countdown',
    brief:
      'A whole deck, one card at a time, the count never shown. Call it at the pauses — a full deck always finishes at 0.',
    speed: 'fast',
    deckCount: 1,
    cardCount: 52,
    checkpoints: 6,
    questions: ['runningCount'],
    questionOrder: 'alternate',
    pass: { minCorrect: 5, maxRunningCountMisses: 1 },
    finalCountQuestion: true,
    answerInput: 'choices',
    showDeckScale: false,
  },
  trayGlance: {
    mode: 'deckEstimate',
    level: 0,
    title: 'Tray Glance',
    brief: 'Read the discard tray against the shoe: how many decks are still to come?',
    speed: 'normal',
    shoeSizes: [2, 4, 6],
    precision: 0.5,
    anyPenetration: false,
    showDeckScale: true,
    streakTarget: PREVIEW_STREAK,
    strikes: PREVIEW_STRIKES,
  },
  divideIt: {
    mode: 'trueCount',
    level: 0,
    title: 'Divide It',
    brief: 'True count = running count ÷ decks remaining. Whole decks, clean division.',
    speed: 'normal',
    halfDecks: false,
    negatives: false,
    cleanDivision: true,
    answerInput: 'choices',
    streakTarget: PREVIEW_STREAK,
    strikes: PREVIEW_STRIKES,
  },
  rampCard: {
    mode: 'betSize',
    level: 0,
    title: 'Ramp Card',
    brief: 'The count is out. What is the bet? True count, rounded down, minus one — one unit at the least.',
    speed: 'normal',
    halfDecks: false,
    showRamp: true,
    answerInput: 'choices',
    streakTarget: PREVIEW_STREAK,
    strikes: PREVIEW_STRIKES,
  },
  sixteenVsTen: {
    mode: 'indexPlay',
    level: 0,
    title: '16 vs 10',
    brief: 'The most valuable index play: 16 against a ten stands at a true count of 0 or higher, and hits below.',
    speed: 'normal',
    plays: 'sixteenVsTen',
    showTrueCount: true,
    streakTarget: PREVIEW_STREAK,
    strikes: PREVIEW_STRIKES,
  },
  casinoNight: {
    mode: 'shoeRun',
    level: 0,
    title: 'Casino Night',
    brief:
      'A short shoe with the pit boss watching. Size every bet off the count and climb the ramp a step at a time — leap, and you are backed off.',
    speed: 'normal',
    deckCount: 6,
    hands: 8,
    betting: true,
    heat: true,
    insurance: true,
    indexPlays: false,
    checks: ['trueCount'],
    checkEvery: 4,
    answerInput: 'entry',
    clearAccuracy: 0.8,
    perfectAccuracy: 0.95,
  },
};

export function previewDrillSpec(id: PreviewDrillId): TrainingLevelSpec {
  return PREVIEW_DRILL_SPECS[id];
}

/** The Casino Night preview is a shoe run; the rest are drills. */
export function isShoeRunDrill(id: PreviewDrillId): boolean {
  return PREVIEW_DRILL_SPECS[id].mode === 'shoeRun';
}

export function previewShoeRunSpec(id: PreviewDrillId): ShoeRunLevel {
  const spec = PREVIEW_DRILL_SPECS[id];
  if (spec.mode !== 'shoeRun') {
    throw new RangeError(`${id} is not a shoe run`);
  }
  return spec;
}
