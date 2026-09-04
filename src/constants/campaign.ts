import { CasinoMap, mapById } from '../engine/betting/casino';

/**
 * The campaign spine: six chapters, one casino and ONE skill each, always in
 * the same four-node rhythm — Lesson (teach) → Drill (practice, the Count
 * Sprint) → Table Night (apply with chips + an objective) → Boss (the 9/9
 * sprint that licenses the floor and opens the next casino).
 *
 * Node completion is deliberately split across stores:
 *   lesson / night → campaignStore (persisted lists)
 *   drill          → table permit  (license ≥ permit, already persisted)
 *   boss           → full license  (license = licensed, already persisted)
 */

export type ChapterNodeType = 'lesson' | 'drill' | 'night' | 'boss';

export const NODE_ORDER: readonly ChapterNodeType[] = ['lesson', 'drill', 'night', 'boss'];

export interface NightObjective {
  /** Rounds dealt before the night ends and the recap grades it. */
  readonly hands: number;
  /** Finish at least this many chips up (0 = just survive). */
  readonly minNetChips: number;
  /** Count checks answered correctly during the night. */
  readonly minChecksCorrect: number;
  /** One-line goal shown at the table and on the recap. */
  readonly label: string;
}

export interface Chapter {
  readonly mapId: number;
  /** The one skill this chapter teaches (journey card subtitle). */
  readonly skill: string;
  readonly night: NightObjective;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    mapId: 1,
    skill: 'Card values & the running count',
    night: {
      hands: 10,
      minNetChips: 0,
      minChecksCorrect: 3,
      label: 'Play 10 hands, answer 3 count checks, don’t lose chips',
    },
  },
  {
    mapId: 2,
    skill: 'Count high → bet big (the money secret)',
    night: {
      hands: 15,
      minNetChips: 200,
      minChecksCorrect: 2,
      label: 'Finish 15 hands up 200+ — bet up when the shoe runs hot',
    },
  },
  {
    mapId: 3,
    skill: 'The true count (divide by decks left)',
    night: {
      hands: 15,
      minNetChips: 0,
      minChecksCorrect: 4,
      label: 'Answer 4 checks — the coach asks for TRUE counts now',
    },
  },
  {
    mapId: 4,
    skill: 'Holding the count under pressure',
    night: {
      hands: 15,
      minNetChips: 250,
      minChecksCorrect: 2,
      label: 'Six decks, real speed — finish up 250+',
    },
  },
  {
    mapId: 5,
    skill: 'Basic strategy joins the count',
    night: {
      hands: 15,
      minNetChips: 500,
      minChecksCorrect: 2,
      label: 'Play the book and the count — finish up 500+',
    },
  },
  {
    mapId: 6,
    skill: 'The gauntlet — everything at once',
    night: {
      hands: 20,
      minNetChips: 1000,
      minChecksCorrect: 3,
      label: '20 hands at Kepler — finish up 1,000+',
    },
  },
];

export function chapterForMap(mapId: number): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.mapId === mapId);
}

export function chapterMap(chapter: Chapter): CasinoMap {
  // Chapters are defined from CASINO_MAPS ids; the lookup cannot miss.
  return mapById(chapter.mapId)!;
}

export const NODE_LABELS: Record<ChapterNodeType, string> = {
  lesson: 'Lesson',
  drill: 'Drill',
  night: 'Table Night',
  boss: 'Boss',
};
