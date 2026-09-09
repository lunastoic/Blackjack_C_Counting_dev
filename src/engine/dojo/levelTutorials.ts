import { flashLevelKey } from './countFlash';

/**
 * Per-level walkthroughs — one to three short slides (four at most) shown the
 * first time a level starts, explaining what that level asks for. The Hi-Lo
 * values primer (FlashTutorial) runs only before map 1, level 1; its slide
 * here follows the primer.
 */

export interface TutorialSlide {
  readonly title: string;
  readonly body: string;
}

export const MAX_TUTORIAL_SLIDES = 4;

const slides = (
  ...entries: readonly (readonly [title: string, body: string])[]
): readonly TutorialSlide[] => entries.map(([title, body]) => ({ title, body }));

const LEVEL_TUTORIALS: Readonly<Record<string, readonly TutorialSlide[]>> = {
  // -------------------------------------------------------------------------
  // Map 1 — Running Count Basics
  // -------------------------------------------------------------------------
  '1:1': slides(
    ['One card at a time', 'Tap its value: −1, 0 or +1. Twenty-one right clears it. Answer before the meter runs dry — right answers top it up.'],
    ['Three strikes', 'A miss is a strike; your count stands. Three to spare — a fourth miss ends the run.'],
  ),
  '1:2': slides(
    ['Two cards, one number', 'Add both values and tap the total.'],
    ['Pairs that cancel', 'A +1 next to a −1 is 0. Two lows are +2, two highs are −2.'],
  ),
  '1:3': slides(
    ['Three, four, then five cards', 'The group grows as your streak does.'],
    ['Cancel first, then count', 'Pair every high with a low. Whatever is left over is the answer.'],
  ),
  '1:4': slides(
    ['The count is yours to keep', 'Cards come one at a time and the total is never shown. Start at 0 and add each card.'],
    ['When the deal pauses', 'Tap the running count. Ten checks, all correct — one miss restarts the deck.'],
  ),
  '1:5': slides(
    ['All 52 cards', 'Same drill, a little quicker. Eight checks along the way.'],
    ['Finish at zero', 'A full deck has as many highs as lows, so it always ends at 0. That is the final question.'],
  ),
  '1:6': slides(
    ['Real blackjack, played for you', 'No chips, no decisions. Just watch the cards.'],
    ['Count everything you can see', 'Both player cards, the dealer’s up card, every hit. The hole card counts when it flips.'],
    ['Six checks', 'All six right and the table opens.'],
  ),

  // -------------------------------------------------------------------------
  // Map 2 — Speed & Cancellation
  // -------------------------------------------------------------------------
  '2:1': slides(['Same values, faster', 'One card, tap its value. Twenty-one right clears it — two strikes now.']),
  '2:2': slides(
    ['Pairs on sight', 'A high with a low is 0. Two lows are +2, two highs are −2.'],
    ['Recognise, don’t add', 'Call the pair the moment it lands. Twenty-one right, two strikes.'],
  ),
  '2:3': slides(
    ['Three to six cards, mixed', 'Group sizes come at random.'],
    ['Pair off, then count', 'Match highs against lows first. Count what is left. Twenty-one right, two strikes.'],
  ),
  '2:4': slides(['A full deck, quicker', 'One card at a time, no total shown. Ten checks, all correct.']),
  '2:5': slides(
    ['Two players and the dealer', 'Everyone gets two cards, all face up. Nobody plays on.'],
    ['Count each hand as a group', 'Cancel within the hand, then add it to the running count. Eight checks, all correct.'],
  ),
  '2:6': slides(
    ['Two decks, no reshuffle', 'The count carries across every hand until the shoe runs out.'],
    ['Hands play themselves', 'Every hit and the hole flip count. Ten checks, all correct.'],
  ),

  // -------------------------------------------------------------------------
  // Map 3 — Deck Estimation
  // -------------------------------------------------------------------------
  '3:1': slides(
    ['Read the tray', 'The discard tray holds what has been dealt. A deck is 52 cards.'],
    ['Decks still to come', 'The shoe minus the tray. Answer in whole decks. Twenty-one right — one strike.'],
  ),
  '3:2': slides(
    ['To the nearest half', '26 cards is half a deck. Two-, four- and six-deck shoes. Twenty-one right, one strike.'],
  ),
  '3:3': slides(
    ['Cut anywhere', 'The tray no longer lands on clean marks. Round to the nearest half deck. Twenty-one right, one strike.'],
  ),
  '3:4': slides(
    ['Two jobs at once', 'Keep the running count while the tray fills.'],
    ['Checks alternate', 'Running count, then decks remaining, and so on. Ten checks, all correct.'],
  ),
  '3:5': slides(
    ['Four decks, random questions', 'Twelve checks ask for the running count or decks remaining, in any order.'],
    ['Ten right to pass', 'You may miss two deck estimates. Never the running count.'],
  ),
  '3:6': slides(
    ['Live table, six decks', 'Two players and the dealer. Glance at the tray between hands.'],
    ['Fourteen checks', 'Twelve right, and no more than one running-count miss.'],
  ),

  // -------------------------------------------------------------------------
  // Map 4 — True Count
  // -------------------------------------------------------------------------
  '4:1': slides(
    ['True count = running ÷ decks', 'The running count and decks remaining are given. Divide.'],
    ['Whole numbers only', '+8 with 2 decks left is +4. Twenty-one in a row — no strikes from here on.'],
  ),
  '4:2': slides(
    ['Half decks', '+6 ÷ 1.5 = +4. +5 ÷ 2.5 = +2.'],
    ['Round to the nearest half', '2.24 rounds to 2. 2.25 rounds to 2.5. Twenty-one in a row, no strikes.'],
  ),
  '4:3': slides(
    ['Negatives divide the same way', '−6 ÷ 2 = −3. Round every answer to the nearest half. Twenty-one in a row, no strikes.'],
  ),
  '4:4': slides(
    ['Two questions each pause', 'First estimate the decks remaining. Then the true count, using the decks shown.'],
    ['Ten checks, nine right', 'Both answers must be right for the check to count.'],
  ),
  '4:5': slides(
    ['Anything goes', 'Twelve questions in random order: running count, decks remaining or true count.'],
    ['Eleven right', 'At most one running-count miss.'],
  ),
  '4:6': slides(
    ['Live six-deck blackjack', 'Two players and the dealer. Every question kind, in any order.'],
    ['Fourteen checks, thirteen right', 'At most one running-count miss.'],
  ),

  // -------------------------------------------------------------------------
  // Map 5 — Real Table Counting
  // -------------------------------------------------------------------------
  '5:1': slides(
    ['One player, basic strategy', 'Hits, doubles and stands are played for you. Count every card that shows.'],
    ['Eight checks, all correct', 'The hole card counts when it flips.'],
  ),
  '5:2': slides(
    ['Two players and the dealer', 'Cards land in table order: one to each seat, then the second round.'],
    ['Count them as they fall', 'Not hand by hand. Ten checks, all correct.'],
  ),
  '5:3': slides(
    ['Four seats, two decks', 'Splits and doubles included. Every exposed card counts.'],
    ['Ten checks, nine right', 'At most one running-count miss.'],
  ),
  '5:4': slides(
    ['Three players, four decks', 'Twelve random checks: running count, decks remaining or true count.'],
    ['Eleven right', 'At most one running-count miss.'],
  ),
  '5:5': slides(
    ['Full table, six decks, faster', 'Fewer pauses between checks.'],
    ['Fourteen checks, thirteen right', 'At most one running-count miss.'],
  ),
  '5:6': slides(
    ['Deep into the shoe', 'Six decks dealt to the cut card. Three players.'],
    ['Sixteen questions, fifteen right', 'Any kind, any order. At most one running-count miss.'],
  ),

  // -------------------------------------------------------------------------
  // Map 6 — Mastery
  // -------------------------------------------------------------------------
  '6:1': slides(
    ['Exact entry', 'No choices this time. Dial in the count and confirm.'],
    ['Ten checks, all perfect', 'Very fast, nothing shown.'],
  ),
  '6:2': slides(
    ['Two decks, exact entry', 'Twelve questions. Some ask for decks remaining.'],
    ['Eleven right', 'Every running-count question must be correct.'],
  ),
  '6:3': slides(
    ['Casino speed', 'Six decks. Running count, decks remaining and true count, all exact entry.'],
    ['Fourteen questions, thirteen right', 'No running-count misses.'],
  ),
  '6:4': slides(
    ['Noise on the felt', 'Chips move, wins and losses are called. None of it is yours.'],
    ['Ignore it and count', 'Fourteen checks, thirteen right. Exact entry.'],
  ),
  '6:5': slides(
    ['A long shoe, few pauses', 'Six decks to the cut card with three players.'],
    ['Twelve questions, eleven right', 'Any kind. Exact entry.'],
  ),
  '6:6': slides(
    ['The exam', 'Six decks to the cut card. Full table, casino speed, casino noise.'],
    ['Twenty questions', 'Eighteen right overall. At most one running-count miss.'],
    ['Pass to graduate', 'Your results break down by question kind. Ninety percent, and you are certified.'],
  ),
};

/** The walkthrough for one level (empty if none is written). */
export function levelTutorial(mapId: number, level: number): readonly TutorialSlide[] {
  return LEVEL_TUTORIALS[flashLevelKey(mapId, level)] ?? [];
}
