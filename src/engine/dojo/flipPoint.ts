import { Card, makeCard, Rank, Suit } from '../cards/card';
import { defaultRng, Rng } from '../shoe/rng';
import { INDEX_PLAYS, IndexPlay, TOP_INDEX_PLAY_IDS } from '../strategy/indexPlays';

/**
 * Flip Point — Titan's level 2. One hand against the dealer's card and a
 * count slider sweeping from −5 to +5; the player stops it where the best
 * move changes (the play's index). A stop within the level's tolerance of
 * the index is right; a sweep that runs out is a miss.
 *
 * Pure TypeScript — no React / RN imports.
 */

/** The slider's ends, in true-count points. */
export const FLIP_MIN = -5;
export const FLIP_MAX = 5;

export interface FlipPointItem {
  readonly play: IndexPlay;
  readonly playerCards: readonly Card[];
  readonly dealerUp: Card;
}

const FLIP_TENS: readonly Rank[] = ['10', 'J', 'Q', 'K'];
const FLIP_SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function pickOne<T>(list: readonly T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)];
}

/** The plays a level draws from: the top six or all of them, indices on the slider only. */
export function flipPointPool(plays: 'top' | 'all'): readonly IndexPlay[] {
  return INDEX_PLAYS.filter(
    (play) =>
      (plays === 'all' || TOP_INDEX_PLAY_IDS.includes(play.id)) &&
      play.index >= FLIP_MIN &&
      play.index <= FLIP_MAX,
  );
}

function worth(rank: Rank): number {
  return FLIP_TENS.includes(rank) ? 10 : Number(rank);
}

/** Two different non-ace values (2–10) that make `total` — never a pair. */
function hardRanks(total: number, rng: Rng): readonly [Rank, Rank] {
  const options: [Rank, Rank][] = [];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', ...FLIP_TENS];
  for (const a of ranks) {
    for (const b of ranks) {
      if (worth(a) + worth(b) === total && worth(a) !== worth(b)) {
        options.push([a, b]);
      }
    }
  }
  return pickOne(options, rng);
}

/** One hand for the slider, never the same spot twice in a row when there is a choice. */
export function makeFlipPointItem(
  plays: 'top' | 'all',
  rng: Rng = defaultRng,
  previousId?: string,
): FlipPointItem {
  const pool = flipPointPool(plays);
  const fresh = pool.length > 1 ? pool.filter((play) => play.id !== previousId) : pool;
  const play = pickOne(fresh, rng);
  let suit = Math.floor(rng() * 4);
  const cardOf = (rank: Rank) => {
    suit += 1;
    return makeCard(rank, FLIP_SUITS[suit % 4], { deckIndex: suit, visibility: 'faceUp' });
  };
  const ranks: readonly Rank[] =
    play.hand === 'pair10' ? [pickOne(FLIP_TENS, rng), pickOne(FLIP_TENS, rng)] : hardRanks(play.hand, rng);
  const upRank: Rank =
    play.up === 11 ? 'A' : play.up === 10 ? pickOne(FLIP_TENS, rng) : (String(play.up) as Rank);
  return { play, playerCards: ranks.map(cardOf), dealerUp: cardOf(upRank) };
}

/** Where the knob is `elapsedMs` into a sweep of `sweepMs`, from −5 to +5. */
export function sweepValueAt(elapsedMs: number, sweepMs: number): number {
  const fraction = sweepMs > 0 ? Math.max(0, Math.min(1, elapsedMs / sweepMs)) : 1;
  return FLIP_MIN + fraction * (FLIP_MAX - FLIP_MIN);
}

/** A slider value as a 0–1 fraction of the track. */
export function sliderFraction(value: number): number {
  return (Math.max(FLIP_MIN, Math.min(FLIP_MAX, value)) - FLIP_MIN) / (FLIP_MAX - FLIP_MIN);
}

/** A stop counts when it lands within `tolerance` of the index. */
export function isFlipStopRight(stop: number, index: number, tolerance: number): boolean {
  return Math.abs(stop - index) <= tolerance + 1e-9;
}
