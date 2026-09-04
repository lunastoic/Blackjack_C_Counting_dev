import { Card, makeCard, Rank, Suit, SUITS, hiLoValue } from '../cards/card';
import { createShoe, DeckCount, draw, Shoe } from '../shoe/shoe';
import { defaultRng, Rng } from '../shoe/rng';

/**
 * Pure generators for the Counting Dojo drills.
 * No React / RN imports — these run in unit tests and stores.
 */

export type DrillType = 'values' | 'running' | 'speed';

export interface DrillResult {
  readonly correct: number;
  readonly totalAnswered: number;
  readonly accuracy: number;
  readonly xp: number;
}

export function scoreDrill(
  correctCount: number,
  totalAnswered: number,
  baseXp: number,
): DrillResult {
  const safeTotal = Math.max(1, totalAnswered);
  const accuracy = correctCount / safeTotal;
  const xp = Math.round(baseXp * accuracy);
  return {
    correct: correctCount,
    totalAnswered,
    accuracy,
    xp,
  };
}

// ---------------------------------------------------------------------------
// Values drill
// ---------------------------------------------------------------------------

export interface ValuesDrillCard {
  readonly card: Card;
  readonly choices: readonly (-1 | 0 | 1)[];
}

/** Build a values drill: 20 random cards, each with 3 plausible value choices. */
export function buildValuesDrill(
  count = 20,
  random: () => number = Math.random,
): ValuesDrillCard[] {
  const suits: Suit[] = [...SUITS];
  const ranks: Rank[] = [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
    'A',
  ];
  const items: ValuesDrillCard[] = [];
  for (let i = 0; i < count; i++) {
    const rank = ranks[Math.floor(random() * ranks.length)];
    const suit = suits[Math.floor(random() * suits.length)];
    const card = makeCard(rank, suit, { deckIndex: 0, visibility: 'faceUp' });
    const correct = hiLoValue(rank);
    const wrongPool = ([-1, 0, 1] as const).filter((v) => v !== correct);
    const choices: (-1 | 0 | 1)[] = [correct, wrongPool[0], wrongPool[1]];
    choices.sort(() => random() - 0.5);
    items.push({ card, choices });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Running / speed drills
// ---------------------------------------------------------------------------

export interface DealtDrillCard {
  readonly card: Card;
  /** Running count AFTER this card is counted. */
  readonly runningCount: number;
}

export interface RunningDrill {
  readonly cards: readonly DealtDrillCard[];
  readonly checkIndexes: readonly number[];
  readonly deckCount: DeckCount;
}

export function dealRunningDrill(
  deckCount: DeckCount = 1,
  cardCount = 26,
  checkEvery = 7,
  rng: Rng = defaultRng,
): RunningDrill {
  let shoe: Shoe = createShoe(deckCount, rng);
  const cards: DealtDrillCard[] = [];
  let runningCount = 0;
  const checkIndexes: number[] = [];

  for (let i = 0; i < cardCount; i++) {
    if (cardsRemaining(shoe) === 0) {
      shoe = createShoe(deckCount, rng);
      runningCount = 0;
    }
    const result = draw(shoe, 'faceUp');
    shoe = result.shoe;
    runningCount += hiLoValue(result.card.rank);
    cards.push({ card: result.card, runningCount });

    if ((i + 1) % checkEvery === 0 && i > 0) {
      checkIndexes.push(i);
    }
  }
  return { cards, checkIndexes, deckCount };
}

/** Build a speed drill: N random face-up cards and the running count at the end. */
export function dealSpeedDrill(
  deckCount: DeckCount = 1,
  cardCount = 10,
  rng: Rng = defaultRng,
): { readonly cards: readonly DealtDrillCard[]; readonly finalCount: number } {
  const { cards } = dealRunningDrill(deckCount, cardCount, cardCount + 1, rng);
  return { cards, finalCount: cards[cards.length - 1]?.runningCount ?? 0 };
}

function cardsRemaining(shoe: Shoe): number {
  return shoe.cards.length - shoe.drawnCount;
}
