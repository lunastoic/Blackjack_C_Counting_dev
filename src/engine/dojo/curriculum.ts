import { Rank, RANKS, hiLoValue } from '../cards/card';

/**
 * Counting Dojo curriculum — the ordered lessons that teach Hi-Lo counting.
 * Pure data; the UI renders these as an interactive lesson player.
 */

export type LessonId =
  | 'hi-lo-values'
  | 'running-count'
  | 'hole-card-rule'
  | 'true-count'
  | 'count-and-play'
  | 'betting-by-count';

export interface LessonStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Optional call-to-action label for the inline action button. */
  readonly actionLabel?: string;
}

export interface Lesson {
  readonly id: LessonId;
  readonly order: number;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: 'cards' | 'count' | 'eye' | 'divide' | 'table' | 'chips';
  readonly steps: readonly LessonStep[];
  /** XP awarded when all steps are completed. */
  readonly xpReward: number;
  /** Minimum dojo rank required to unlock (0 = free from the start). */
  readonly requiredRank: number;
}

export const DOJO_LESSONS: readonly Lesson[] = [
  {
    id: 'hi-lo-values',
    order: 1,
    title: 'Hi-Lo Values',
    subtitle: 'Every card has a value: +1, 0, or −1.',
    icon: 'cards',
    xpReward: 10,
    requiredRank: 0,
    steps: [
      {
        id: 'intro',
        title: 'The language of the count',
        body: 'Card counters don\'t memorize every card. They track one number: the running count. In the Hi-Lo system, each card changes that number by +1, 0, or −1.',
      },
      {
        id: 'low-cards',
        title: 'Low cards are +1',
        body: 'When a 2, 3, 4, 5, or 6 leaves the shoe, the count goes UP by one. Small cards are good for the dealer, so their absence helps the player.',
        actionLabel: 'See the glow',
      },
      {
        id: 'neutral-cards',
        title: '7, 8, 9 are 0',
        body: 'Middle cards don\'t move the count. They\'re roughly neutral for both you and the dealer.',
      },
      {
        id: 'high-cards',
        title: 'High cards are −1',
        body: 'When a 10, Jack, Queen, King, or Ace leaves the shoe, the count goes DOWN by one. Big cards help the player, so their absence hurts.',
        actionLabel: 'Practice values',
      },
      {
        id: 'summary',
        title: 'Memorize this',
        body: '2–6 = +1, 7–9 = 0, 10-A = −1. That\'s the entire Hi-Lo system. Everything else is just speed and discipline.',
      },
    ],
  },
  {
    id: 'running-count',
    order: 2,
    title: 'Running Count',
    subtitle: 'Add and subtract as cards appear.',
    icon: 'count',
    xpReward: 15,
    requiredRank: 0,
    steps: [
      {
        id: 'intro',
        title: 'Keep a running total',
        body: 'Start at 0. Every face-up card changes the running count. Your job is to update it instantly, without thinking about the value of each card.',
      },
      {
        id: 'one-at-a-time',
        title: 'One card at a time',
        body: 'Deal cards slowly at first. Say the count out loud or tap the counter after each card. Speed comes from repetition.',
        actionLabel: 'Deal cards',
      },
      {
        id: 'pairs',
        title: 'Cancel pairs',
        body: 'With practice, you\'ll see a high and low card together and they\'ll cancel to 0. A 5 (+1) and a King (−1) = no change.',
      },
      {
        id: 'rhythm',
        title: 'Find your rhythm',
        body: 'The count should feel like a heartbeat. If you\'re pausing to calculate, slow down. Accuracy first, speed second.',
      },
    ],
  },
  {
    id: 'hole-card-rule',
    order: 3,
    title: 'The Hole Card Rule',
    subtitle: 'Count only what you can see.',
    icon: 'eye',
    xpReward: 10,
    requiredRank: 1,
    steps: [
      {
        id: 'intro',
        title: 'Face-down cards don\'t count',
        body: 'The dealer\'s second card is dealt face down. Until it flips, it is invisible to you — and it does NOT change the running count.',
      },
      {
        id: 'patience',
        title: 'Patience pays',
        body: 'Counting cards you can\'t see is the most common beginner mistake. Wait for the reveal, then update the count.',
        actionLabel: 'Spot the hole card',
      },
      {
        id: 'reveal',
        title: 'Update on the reveal',
        body: 'When the dealer flips the hole card or draws a new card, treat it like any other face-up card. Add or subtract immediately.',
      },
    ],
  },
  {
    id: 'true-count',
    order: 4,
    title: 'True Count',
    subtitle: 'Adjust for decks remaining.',
    icon: 'divide',
    xpReward: 20,
    requiredRank: 2,
    steps: [
      {
        id: 'why',
        title: 'Why true count matters',
        body: 'A running count of +6 means very different things in a 1-deck game versus an 8-deck shoe. The true count divides by decks left.',
      },
      {
        id: 'formula',
        title: 'The formula',
        body: 'True Count = Running Count ÷ Decks Remaining. Round to the nearest half. +6 with 3 decks left = +2. +5 with 2 decks left = +2.5.',
        actionLabel: 'Try the math',
      },
      {
        id: 'estimate',
        title: 'Estimate decks',
        body: 'You don\'t need to be exact. Look at the discard tray and estimate to the nearest half deck. Casinos expect you to estimate.',
      },
      {
        id: 'betting-edge',
        title: 'The edge number',
        body: 'The true count is what tells you how much to bet. Positive counts favor the player; negative counts favor the house.',
      },
    ],
  },
  {
    id: 'count-and-play',
    order: 5,
    title: 'Count & Play',
    subtitle: 'Keep the count while making decisions.',
    icon: 'table',
    xpReward: 25,
    requiredRank: 3,
    steps: [
      {
        id: 'split-attention',
        title: 'Split your attention',
        body: 'At a real table you must play perfect basic strategy AND update the count on every card. This is where it gets real.',
      },
      {
        id: 'deal-order',
        title: 'Watch the deal order',
        body: 'Your cards, dealer up-card, your hit cards, dealer hole reveal, dealer draws — every visible card changes the count.',
        actionLabel: 'Play a guided hand',
      },
      {
        id: 'mistakes',
        title: 'Mistakes are data',
        body: 'If you lose the count, start over at 0 mentally and keep watching. In practice, you can tap the meter to check — at the casino, there is no check.',
      },
    ],
  },
  {
    id: 'betting-by-count',
    order: 6,
    title: 'Bet by the Count',
    subtitle: 'Put the edge to work.',
    icon: 'chips',
    xpReward: 25,
    requiredRank: 4,
    steps: [
      {
        id: 'spread',
        title: 'The betting spread',
        body: 'Bet small or sit out when the count is 0 or negative. Increase your bet as the true count rises. A common spread is 1 unit at +1, 2 at +2, 4 at +3.',
      },
      {
        id: 'camouflage',
        title: 'Don\'t be obvious',
        body: 'Jumping from the table minimum to the maximum will get you backed off. Vary your bets smoothly and with the flow of the game.',
        actionLabel: 'Practice spreads',
      },
      {
        id: 'discipline',
        title: 'Discipline is the weapon',
        body: 'Card counting gives a small edge. The only way to win is to play thousands of hands with perfect counting and disciplined betting.',
      },
    ],
  },
] as const;

export const LESSON_BY_ID: Readonly<Record<LessonId, Lesson>> = Object.fromEntries(
  DOJO_LESSONS.map((lesson) => [lesson.id, lesson]),
) as Readonly<Record<LessonId, Lesson>>;

export function lessonById(id: LessonId): Lesson | undefined {
  return LESSON_BY_ID[id];
}

export function nextLessonId(completed: ReadonlySet<LessonId>): LessonId | null {
  for (const lesson of DOJO_LESSONS) {
    if (!completed.has(lesson.id)) {
      return lesson.id;
    }
  }
  return null;
}

/** Hi-Lo value groups for quick UI tables. */
export const HI_LO_GROUPS: Readonly<
  Record<-1 | 0 | 1, { readonly label: string; readonly ranks: readonly Rank[]; readonly color: 'plus' | 'neutral' | 'minus' }>
> = {
  1: { label: '+1', ranks: RANKS.filter((r) => hiLoValue(r) === 1), color: 'plus' },
  0: { label: '0', ranks: RANKS.filter((r) => hiLoValue(r) === 0), color: 'neutral' },
  '-1': { label: '−1', ranks: RANKS.filter((r) => hiLoValue(r) === -1), color: 'minus' },
};
