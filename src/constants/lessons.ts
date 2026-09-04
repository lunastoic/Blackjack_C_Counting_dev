import { Rank } from '../engine/cards/card';

/**
 * Mentor lesson scripts — the teaching half of every chapter, played by
 * app/lesson/[mapId].tsx. Untimed, forgiving, one idea at a time.
 *
 * Step kinds:
 *   say        mentor line on a card, Continue to advance
 *   showCard   a card with its Hi-Lo value spelled out (worked example)
 *   tapValue   the player taps −1 / 0 / +1 for a shown card (retry until right)
 *   countCards cards appear one by one, untimed; then "what's the count?"
 *              (wrong answers show the annotated review and retry)
 *   ask        a multiple-choice concept question with an explanation
 */
export type LessonStep =
  | { readonly kind: 'say'; readonly text: string }
  | { readonly kind: 'showCard'; readonly rank: Rank; readonly note: string }
  | { readonly kind: 'tapValue'; readonly rank: Rank }
  | {
      readonly kind: 'countCards';
      readonly ranks: readonly Rank[];
      /** Positions shown face-down: they count 0 — the chapter-4 lesson. */
      readonly decoyIndexes?: readonly number[];
    }
  | {
      readonly kind: 'ask';
      readonly prompt: string;
      readonly choices: readonly string[];
      readonly correctIndex: number;
      readonly explain: string;
    };

export const LESSONS: Readonly<Record<number, readonly LessonStep[]>> = {
  1: [
    {
      kind: 'say',
      text: 'Welcome, kid. First rule: the shoe talks. When the little cards leave, the big cards are still in there waiting — and big cards are good for you. We track that with one number.',
    },
    {
      kind: 'say',
      text: 'Hi-Lo. Three buckets, that’s the whole alphabet:\n\n2–6 → +1\n7–9 → 0\n10, J, Q, K, A → −1',
    },
    { kind: 'showCard', rank: '5', note: 'A five is a little card leaving the shoe. Count goes UP one: +1.' },
    { kind: 'showCard', rank: 'K', note: 'A king is a big card gone. Count comes DOWN one — we’re back to 0.' },
    { kind: 'tapValue', rank: '3' },
    { kind: 'tapValue', rank: '9' },
    { kind: 'tapValue', rank: 'A' },
    { kind: 'say', text: 'Now string them together. Cards come one at a time — keep the tally in your head. No clock, no pressure.' },
    { kind: 'countCards', ranks: ['4', 'K', '6'] },
    { kind: 'countCards', ranks: ['2', '9', 'J', '5', 'Q'] },
    {
      kind: 'say',
      text: 'That number is the RUNNING COUNT. It starts at 0 every shuffle and never stops moving. The drill next door will teach your eyes to keep up.',
    },
  ],
  2: [
    {
      kind: 'say',
      text: 'So why count at all? Because blackjack pays YOU better when the shoe is full of big cards: your blackjacks pay 3:2, your doubles hit, and the dealer busts more.',
    },
    {
      kind: 'say',
      text: 'A HIGH count means the little cards are gone — the shoe is rich with tens and aces. For those hands, the edge isn’t the house’s. It’s yours.',
    },
    {
      kind: 'say',
      text: 'So here is the entire secret, one line:\n\nCount HIGH → bet BIG.\nCount low or minus → bet small.\n\nThat’s card counting. Everything else is practice.',
    },
    {
      kind: 'ask',
      prompt: 'The running count hits +5 late in the shoe. What do you do?',
      choices: ['Raise my bet', 'Lower my bet', 'Bet the same', 'Walk away'],
      correctIndex: 0,
      explain: 'A rich shoe favors the player — this is exactly the moment counters push chips in.',
    },
    { kind: 'countCards', ranks: ['3', '4', '5', '10', '2', '6'] },
    {
      kind: 'say',
      text: 'On my floor the meter stays fogged until you prove the count. Tonight: fifteen hands. When it runs hot, bet up — that’s the objective.',
    },
  ],
  3: [
    {
      kind: 'say',
      text: 'Bad news: the running count lies in a big shoe. +6 with five decks left is watered down. +6 with one deck left is a gold mine.',
    },
    {
      kind: 'say',
      text: 'So we fix it with one division:\n\nTRUE COUNT = running count ÷ decks remaining.\n\nThat’s the number that sizes your bet.',
    },
    {
      kind: 'ask',
      prompt: 'Running count +6, about 3 decks left in the shoe. True count?',
      choices: ['+2', '+6', '+3', '+1.5'],
      correctIndex: 0,
      explain: '6 ÷ 3 = +2. Same running count, honest number.',
    },
    {
      kind: 'ask',
      prompt: 'Running count +4, about 2 decks left. True count?',
      choices: ['+2', '+4', '+1', '+8'],
      correctIndex: 0,
      explain: '4 ÷ 2 = +2. Round to the nearest half and move on.',
    },
    {
      kind: 'say',
      text: 'Europa deals four decks. Glance at the discard tray, guess the decks left, divide. Rough is fine — counters estimate, they don’t do long division.',
    },
    { kind: 'countCards', ranks: ['K', 'Q', '2', 'A', '9', '3', '10'] },
    {
      kind: 'say',
      text: 'Minus shoe like that one? Small bets, or sit a hand out. The count decides — not your gut.',
    },
  ],
  4: [
    {
      kind: 'say',
      text: 'Casinos aren’t a quiet study hall. Cards land fast, sometimes two at once, and half of what’s on the felt means nothing.',
    },
    {
      kind: 'say',
      text: 'Iron rule: you only count what you can SEE. A face-down card counts ZERO until it flips. Counting cards you can’t see is how beginners lose the thread.',
    },
    { kind: 'countCards', ranks: ['5', 'K', '7', '6', '10'], decoyIndexes: [1] },
    { kind: 'countCards', ranks: ['A', '4', '4', 'J', '8', '2', 'K'] },
    {
      kind: 'say',
      text: 'Ganymede runs six decks at real speed. Your job tonight is boring on purpose: keep one number steady while everything around it moves.',
    },
  ],
  5: [
    {
      kind: 'say',
      text: 'The count tells you WHEN to bet. Basic strategy tells you HOW to play the hand you’re dealt. You need both or the count’s edge leaks away.',
    },
    {
      kind: 'say',
      text: 'The bones of the book:\n\nStand on 17+. Hit 8 or less.\nDouble 11.\nSplit aces and eights — never fives or tens.\nDealer showing 2–6 is weak: let them bust.',
    },
    {
      kind: 'ask',
      prompt: 'You hold 16. Dealer shows a 10. The book says?',
      choices: ['Hit', 'Stand', 'Double', 'Surrender to the pit boss'],
      correctIndex: 0,
      explain: '16 v 10 is a hit by the book — you lose less taking the card.',
    },
    {
      kind: 'ask',
      prompt: 'Pair of 8s. Dealer shows a 6. The book says?',
      choices: ['Split', 'Stand', 'Hit', 'Double'],
      correctIndex: 0,
      explain: 'Two 8s make 16 — the worst hand. Split them against a weak dealer and fight two better ones.',
    },
    {
      kind: 'say',
      text: 'One counter’s twist to start with: when the shoe runs hot — true +3 or better — take the safe stands. Even that ugly 16 against a 10 stands, because the shoe is full of tens.',
    },
    { kind: 'countCards', ranks: ['9', '2', 'A', '6', '6', 'K', '3', '7'] },
  ],
  6: [
    {
      kind: 'say',
      text: 'Last stop. Eight decks, a dealer who never slows down, decoys everywhere. Nothing new tonight — just everything, at once.',
    },
    {
      kind: 'say',
      text: 'One last lesson, and it isn’t math: don’t be obvious. Lurching from minimum to maximum screams “counter”. Climb your bets like a gambler on a heater — smooth.',
    },
    { kind: 'countCards', ranks: ['10', '3', '5', 'A', '8', '4', 'Q', '6', '2'] },
    {
      kind: 'say',
      text: 'Run all nine at my sprint table and Kepler’s floor is yours — and you’re not a student anymore. Go.',
    },
  ],
};
