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
    ['Cancel them out', 'A +1 and a −1 add up to 0. Drag a 2–6 onto the nearest 10–A and both vanish.'],
    ['Zeros just go', 'A 7, 8 or 9 is already 0 — tap it to clear it.'],
    ['Call what’s left', 'When no pairs are left, tap the count of the cards still on the board.'],
    ['Watch the meter', 'It drains while the grid is up; every clear tops it up. A bad drop costs a strike.'],
  ),
  '1:3': slides(
    ['Pairs, then threes, then fours', 'Add the cards in each group and tap the total. Eight right at each size earns a star.'],
    ['Cancel first, then count', 'Pair every high with a low. Whatever is left over is the answer.'],
  ),
  '1:4': slides(
    ['Card Rain', 'Cards drop from the top one at a time. The total is never shown — start at 0 and add each card.'],
    ['When the rain stops', 'Every 5 to 10 cards it pauses. Type the running count since the very first card.'],
  ),
  '1:5': slides(
    ['Table night: your hands, your count', 'A one-deck shoe. You play every hand — the glowing button is the book play.'],
    ['Count before you bet', 'Before each hand, call the running count before the clock runs out.'],
    ['Eighty percent clears it', 'Ten hands. Every count right earns all three stars.'],
  ),
  '1:6': slides(
    ['Boss: Zero Hero', 'A full deck always counts back to 0, so the deal stops early: somewhere from card 39 to 48.'],
    ['Type the count', 'When the cards stop, type the running count. Three rounds; two right clears it.'],
  ),

  // -------------------------------------------------------------------------
  // Map 2 — Io Inferno: basic strategy
  // -------------------------------------------------------------------------
  '2:1': slides(
    ['Every hand has a best move', 'It depends on your two cards and the dealer’s card you can see.'],
    ['Pick it fast', 'Tap hit, stand, double or split before the meter empties. A miss shows the right move and why.'],
  ),
  '2:2': slides(
    ['Swipe the move', 'Swipe left to hit, right to stand, up to double, down to split.'],
    ['Build a combo', 'Fast right swipes stack a combo. A wrong swipe is a strike. A star for each wave of ten.'],
  ),
  '2:3': slides(
    ['Three kinds of hand', 'Hard totals first, then soft totals with an Ace, then pairs.'],
    ['Eight right per stage', 'Each stage earns a star. Three strikes for the whole run.'],
  ),
  '2:4': slides(
    ['Play and count together', 'You play every hand by the book — nothing glows now.'],
    ['When the deal pauses', 'Every few hands, type the running count. Bad moves and wrong counts both cost you.'],
  ),
  '2:5': slides(
    ['Table night', 'Twelve hands. Every move is graded and no button lights up.'],
    ['Count before you bet', 'Before each hand, call the running count — eight seconds on the clock.'],
  ),
  '2:6': slides(
    ['Boss: a clean shoe', 'A whole two-deck shoe that you play, calling the count before every hand.'],
    ['Three strikes of each', 'A third bad move or a third wrong count ends it. 85% clears.'],
  ),

  // -------------------------------------------------------------------------
  // Map 3 — Europa Ice: the true count
  // -------------------------------------------------------------------------
  '3:1': slides(
    ['How much is left?', 'Look at the discard tray against the shoe. Tap the decks still to come.'],
    ['Bigger shoes each stage', 'One deck, then two, then four. A star for each stage.'],
  ),
  '3:2': slides(
    ['Divide and match', 'A target true count sits on top. Count tiles and deck tiles fill the grid.'],
    ['Make the target', 'Drag a count onto a deck tile that divides to it: +6 on 3 decks makes +2.'],
  ),
  '3:3': slides(
    ['The true count', 'Running count ÷ decks left, rounded down. +8 with 2 decks left is +4.'],
    ['Three stages', 'Whole decks, then half decks, then negative counts. Eight right each.'],
  ),
  '3:4': slides(
    ['Live true count', 'Cards stream from a two-deck shoe; the count is yours to keep.'],
    ['Two answers per pause', 'Type the decks left, then the true count. Both must be right.'],
  ),
  '3:5': slides(
    ['Table night, true count', 'Twelve hands at a four-deck table, your moves graded.'],
    ['Call the true count', 'Before each hand, the TRUE count — ten seconds on the clock.'],
  ),
  '3:6': slides(
    ['Boss: count along', 'The hands play themselves at a four-deck table. You just follow every card.'],
    ['Two calls per hand', 'Before each hand: the running count, then the true count. 85% clears.'],
  ),

  // -------------------------------------------------------------------------
  // Map 4 — Ganymede: betting the count
  // -------------------------------------------------------------------------
  '4:1': slides(
    ['Bet with the count', 'True count, minus one, from 1 to 8 units. +3 bets 2 units.'],
    ['Lose the chart', 'The chart sits beside the question — after ten right, it hides.'],
  ),
  '4:2': slides(
    ['Chip rush', 'True-count cards slide toward the edge. Bet on the front one.'],
    ['Drop the right stack', 'Drag the stack onto the circle before it escapes. Each wave is faster.'],
  ),
  '4:3': slides(
    ['Ramp stages', 'True count shown, then running count and decks, then half decks.'],
    ['Work it out', 'Divide, round down, take one off. Eight right per stage.'],
  ),
  '4:4': slides(
    ['Count, then bet', 'Cards stream from a four-deck shoe and no count is shown.'],
    ['At each pause', 'Type your bet. You need the count, the decks left and the ramp.'],
  ),
  '4:5': slides(
    ['Table night, your bets', 'Fifteen hands at a six-deck table. You size every bet.'],
    ['All of it graded', 'Bets, moves and a count call every third hand. 85% clears.'],
  ),
  '4:6': slides(
    ['Boss: count along', 'Three players on autoplay at a six-deck table. You watch and count.'],
    ['Three calls per hand', 'Running count, true count, then your bet. 85% clears.'],
  ),

  // -------------------------------------------------------------------------
  // Map 5 — Titan: playing the count
  // -------------------------------------------------------------------------
  '5:1': slides(
    ['Insurance', 'When the dealer shows an Ace you may insure. It is usually a bad bet.'],
    ['Take it at +3', 'Only take insurance when the true count is +3 or higher.'],
  ),
  '5:2': slides(
    ['Find the flip', 'A few hands change their best move when the count climbs.'],
    ['Stop the slider', 'Tap STOP where the move changes — 0 for 16 vs 10. Within half a point is right.'],
  ),
  '5:3': slides(
    ['When the chart is wrong', 'The top plays first, then all of them.'],
    ['When NOT to change', 'Last stage, normal hands mix in. Most hands still follow the chart.'],
  ),
  '5:4': slides(
    ['Change or not', 'A fast stream of hands, each with its count.'],
    ['One in three', 'About one hand in three is a count play. The rest follow the chart. Two strikes.'],
  ),
  '5:5': slides(
    ['Table night, all in', 'Fifteen hands at an eight-deck table.'],
    ['Everything graded', 'Insurance, count plays, bets and your count. 85% clears.'],
  ),
  '5:6': slides(
    ['Boss: count along', 'Three players on autoplay at an eight-deck table.'],
    ['Calls per hand', 'True count, then your bet — and insurance when the dealer shows an Ace.'],
  ),

  // -------------------------------------------------------------------------
  // Map 6 — Kepler: the final exam
  // -------------------------------------------------------------------------
  '6:1': slides(
    ['Casino speed', 'Single cards and small groups at real dealer pace.'],
    ['One strike', 'Tap the value before the fast meter empties. One miss ends it.'],
  ),
  '6:2': slides(
    ['Busy table', 'The whole table flashes, then flips face down.'],
    ['Count what you saw', 'Type the count of every card. Shorter flashes each stage.'],
  ),
  '6:3': slides(
    ['Distractions', 'A quiet table first, then chips, sounds and win/loss calls.'],
    ['Small talk', 'For three stars the dealer chats. Answer him and keep the count.'],
  ),
  '6:4': slides(
    ['The long shift', 'Two eight-deck shoes back to back at casino speed.'],
    ['New shoe, new count', 'The count starts over with the second shoe. One miss ends the shift.'],
  ),
  '6:5': slides(
    ['A long night', 'Twenty-five hands at casino speed.'],
    ['Everything graded', 'Counts, bets, moves, insurance and count plays. 90% clears.'],
  ),
  '6:6': slides(
    ['Final boss', 'A whole eight-deck shoe at casino speed, the pit boss watching.'],
    ['Beat the casino', 'Every call graded. 90% with no back-off makes you a card counter.'],
  ),
};

/** The walkthrough for one level (empty if none is written). */
export function levelTutorial(mapId: number, level: number): readonly TutorialSlide[] {
  return LEVEL_TUTORIALS[flashLevelKey(mapId, level)] ?? [];
}
