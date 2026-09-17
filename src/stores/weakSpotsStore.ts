import { create } from 'zustand';
import { PlayerAction } from '../engine/blackjack/rules';
import { Rank, Suit } from '../engine/cards/card';
import { dealerUpLabel, handLabel } from '../engine/strategy/describe';
import { SaveData, WeakSpotSave } from '../persistence/schema';

/** How many weak spots the log keeps — the newest wins. */
export const MAX_WEAK_SPOTS = 40;

export type WeakSpot = WeakSpotSave;

export interface WeakSpotInput {
  readonly cards: readonly { readonly rank: Rank; readonly suit: Suit }[];
  readonly dealerUpRank: Rank;
  readonly canDouble: boolean;
  readonly canSplit: boolean;
  readonly chosen: PlayerAction;
  readonly book: PlayerAction;
  readonly reasonCode: string;
  /** Set for an index play: the right call depends on this true count. */
  readonly trueCount?: number;
}

/**
 * Every hand the player played off-book at the table, keyed by the
 * situation ("Hard 16 vs 10", with the same double/split options) so a
 * repeat offender bumps its count instead of piling up. The Weak Spots drill
 * replays them and a right answer clears the spot.
 */
export interface WeakSpotsState {
  /** Newest first. */
  readonly spots: readonly WeakSpot[];
  record(input: WeakSpotInput, now?: number): void;
  /** The drill got it right: the spot is gone. */
  clear(key: string): void;
  resetAll(): void;
  hydrate(data: SaveData['weakSpots']): void;
}

export function weakSpotKey(
  input: Pick<WeakSpotInput, 'cards' | 'dealerUpRank' | 'canDouble' | 'canSplit' | 'trueCount'>,
): string {
  const options = `${input.canDouble ? 'd' : '-'}${input.canSplit ? 's' : '-'}`;
  const count = input.trueCount === undefined ? '' : `|tc${input.trueCount}`;
  return `${handLabel(input.cards)}|${dealerUpLabel(input.dealerUpRank)}|${options}${count}`;
}

export const useWeakSpotsStore = create<WeakSpotsState>()((set, get) => ({
  spots: [],

  record: (input, now = Date.now()) => {
    const key = weakSpotKey(input);
    const previous = get().spots.find((spot) => spot.key === key);
    const spot: WeakSpot = {
      key,
      cards: input.cards.map((card) => ({ rank: card.rank, suit: card.suit })),
      dealerUpRank: input.dealerUpRank,
      canDouble: input.canDouble,
      canSplit: input.canSplit,
      chosen: input.chosen,
      book: input.book,
      reasonCode: input.reasonCode,
      ...(input.trueCount === undefined ? {} : { trueCount: input.trueCount }),
      times: (previous?.times ?? 0) + 1,
      lastAt: now,
    };
    set({
      spots: [spot, ...get().spots.filter((other) => other.key !== key)].slice(0, MAX_WEAK_SPOTS),
    });
  },

  clear: (key) => set({ spots: get().spots.filter((spot) => spot.key !== key) }),

  resetAll: () => set({ spots: [] }),

  hydrate: (data) => set({ spots: data.spots.slice(0, MAX_WEAK_SPOTS) }),
}));
