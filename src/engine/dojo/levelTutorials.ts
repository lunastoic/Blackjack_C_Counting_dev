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
  // One slide: the primer has just run, so the first level is a single tap away.
  '1:1': slides([
    'One card at a time',
    'Tap its value: −1, 0 or +1, before the meter runs dry. Twenty-one right clears the level; a fourth miss ends the run.',
  ]),
  '1:2': slides(
    ['Two cards, one number', 'Add both values and tap the total.'],
    ['Pairs that cancel', 'A +1 next to a −1 is 0. Two lows are +2, two highs are −2.'],
  ),
  '1:3': slides(
    ['Three cards, one number', 'Add all three values and tap the total.'],
    ['Cancel first, then count', 'Pair every high with a low. Whatever is left over is the answer.'],
  ),
  '1:4': slides(
    ['Four cards, one number', 'Add all four values and tap the total.'],
    ['Cancel first, then count', 'Pair every high with a low. Whatever is left over is the answer.'],
  ),
  '1:5': slides(
    ['The count is yours to keep', 'Cards come one at a time and the total is never shown. Start at 0 and add each card.'],
    ['When the deal pauses', 'Tap the running count. Ten checks, all correct — one miss restarts the deck.'],
  ),
  '1:6': slides(
    ['Boss: your hands, your count', 'A one-deck shoe. You play every hand — the glowing button is the book play.'],
    ['Count before you bet', 'Before each hand, call the running count. The hole card counts when it flips.'],
    ['Eighty percent clears it', 'Ten hands. Every count right earns all three stars.'],
  ),

  // -------------------------------------------------------------------------
  // Map 2 — Table Speed
  // -------------------------------------------------------------------------
  '2:1': slides(
    ['All 52 cards, at speed', 'One card at a time, the total never shown. Eight checks along the way.'],
    ['Finish at zero', 'A full deck has as many highs as lows, so it always ends at 0. That is the final question.'],
  ),
  '2:2': slides(
    ['Pairs on sight', 'A high with a low is 0. Two lows are +2, two highs are −2.'],
    ['Recognise, don’t add', 'Call the pair the moment it lands. Twenty-one right, two strikes.'],
  ),
  '2:3': slides(
    ['Three to six cards, mixed', 'Group sizes come at random.'],
    ['Pair off, then count', 'Match highs against lows first. Count what is left. Twenty-one right, two strikes.'],
  ),
  '2:4': slides(
    ['Two players and the dealer', 'Everyone gets two cards, all face up. Nobody plays on.'],
    ['Count each hand as a group', 'Cancel within the hand, then add it to the running count. Eight checks, all correct.'],
  ),
  '2:5': slides(
    ['Two decks, no reshuffle', 'The count carries across every hand until the shoe runs out.'],
    ['Hands play themselves', 'Every hit and the hole flip count. Ten checks, all correct.'],
  ),
  '2:6': slides(
    ['Boss: two decks at table speed', 'Your hands, dealt fast. Call the running count before every hand.'],
    ['Eighty-five percent clears it', 'Fourteen hands. Every count right for three stars.'],
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
    ['Boss: a six-deck shoe', 'You play every hand. Before each one, the running count or the decks left — typed.'],
    ['Read the tray as you go', 'Sixteen hands. Eighty-five percent clears it, every call right for three stars.'],
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
    ['Still whole answers', 'Every division comes out clean. Twenty-one in a row, no strikes.'],
  ),
  '4:3': slides(
    ['Always round down', '+5 ÷ 2 = +2.5, so the true count is +2. Negatives go down too: −3 ÷ 2 = −1.5 is −2.'],
    ['Why down', 'Rounding down never overstates your edge, so you never bet on a count you lack. Twenty-one in a row, no strikes.'],
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
    ['Boss: count, divide, play', 'Six decks, your hands. Before each one, the running count or the true count.'],
    ['Round down', 'Sixteen hands. Eighty-five percent clears it, every call right for three stars.'],
  ),

  // -------------------------------------------------------------------------
  // Map 5 — Betting the Count
  // -------------------------------------------------------------------------
  '5:1': slides(
    ['Why you count', 'The count tells you when the shoe favours you. That is when the bet goes up.'],
    ['True count minus one', 'Divide, round down, take one off: +7 with 2 decks is +3, so 2 units.'],
    ['One to eight units', 'Flat or cold, bet 1 unit. Never more than 8. Twenty-one right, one strike.'],
  ),
  '5:2': slides(
    ['The dealer shows an Ace', 'Insurance is a side bet that the hole card is a ten. It loses money at a normal count.'],
    ['Take it at +3', 'At a true count of +3 or higher the shoe is rich in tens and it pays. Below, always decline.'],
  ),
  '5:3': slides(
    ['Three players, four decks', 'Twelve random checks: running count, decks remaining or true count.'],
    ['Eleven right', 'At most one running-count miss.'],
  ),
  '5:4': slides(
    ['Full table, six decks, faster', 'Fewer pauses between checks.'],
    ['Fourteen checks, thirteen right', 'At most one running-count miss.'],
  ),
  '5:5': slides(
    ['Deep into the shoe', 'Six decks dealt to the cut card. Three players.'],
    ['Sixteen questions, fifteen right', 'Any kind, any order. At most one running-count miss.'],
  ),
  '5:6': slides(
    ['Boss: bet it', 'Six decks. Size every bet off the count and call insurance on an Ace.'],
    ['Mind the pit boss', 'Jump from 1 unit to 8 and you draw heat. Too much heat and you are backed off.'],
    ['You versus a flat bettor', 'At the end, see what your bets won against one unit a hand on the same cards.'],
  ),

  // -------------------------------------------------------------------------
  // Map 6 — Playing the Count
  // -------------------------------------------------------------------------
  '6:1': slides(
    ['The count changes the play', 'A few hands play differently when the shoe is rich or poor.'],
    ['Six to learn first', '16 vs 10 stands at 0 · 15 vs 10 at +4 · 10 vs 10 doubles at +4 · 12 vs 3 stands at +2.'],
    ['Split tens?', 'Only against a 5 at +5 or a 6 at +4. True count given. One strike.'],
  ),
  '6:2': slides(
    ['Every index play', 'All seventeen plus insurance, the running count and decks left given.'],
    ['Work out the true count', 'Divide, round down, then make the call. Twenty-one right, one strike.'],
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
    ['The exam', 'Six decks, twenty-four hands. Counts, bets, insurance and index plays are all graded.'],
    ['The pit boss is watching', 'Ramp your bets steadily. Too much heat ends the exam.'],
    ['Eighty-five percent to graduate', 'Ninety-five for three stars.'],
  ),
};

/** The walkthrough for one level (empty if none is written). */
export function levelTutorial(mapId: number, level: number): readonly TutorialSlide[] {
  return LEVEL_TUTORIALS[flashLevelKey(mapId, level)] ?? [];
}
