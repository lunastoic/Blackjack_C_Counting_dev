import { create } from 'zustand';
import { CHAPTERS, ChapterNodeType, NODE_ORDER, chapterForMap } from '../constants/campaign';
import { SaveData } from '../persistence/schema';
import { useProgressionStore } from './progressionStore';

/**
 * Campaign progress. Only lessons and table nights are stored here; the
 * other two node types read straight from the license system:
 *
 *   drill done → table permit  (3-in-a-row Count Sprint)
 *   boss  done → full license  (9/9 Count Sprint)
 *
 * That keeps a single source of truth for "how good is this player at this
 * casino" — the licenses — with the campaign as a thin layer on top.
 */
interface CampaignState {
  readonly lessonsDone: readonly number[];
  readonly nightsDone: readonly number[];

  markLessonDone(mapId: number): void;
  markNightDone(mapId: number): void;
  isNodeDone(mapId: number, node: ChapterNodeType): boolean;
  /** Chapter 1 is always open; later chapters need the previous boss beaten. */
  isChapterUnlocked(mapId: number): boolean;
  /** The next incomplete node on the journey, or null once graduated. */
  nextNode(): { mapId: number; node: ChapterNodeType } | null;
  /** All six bosses beaten — free play + pro tools unlock. */
  isGraduated(): boolean;
  hydrate(data: SaveData['campaign']): void;
}

export const useCampaignStore = create<CampaignState>()((set, get) => ({
  lessonsDone: [],
  nightsDone: [],

  markLessonDone: (mapId) => {
    if (!chapterForMap(mapId) || get().lessonsDone.includes(mapId)) {
      return;
    }
    set((state) => ({ lessonsDone: [...state.lessonsDone, mapId] }));
  },

  markNightDone: (mapId) => {
    if (!chapterForMap(mapId) || get().nightsDone.includes(mapId)) {
      return;
    }
    set((state) => ({ nightsDone: [...state.nightsDone, mapId] }));
  },

  isNodeDone: (mapId, node) => {
    const license = useProgressionStore.getState().licenseForMap(mapId);
    switch (node) {
      case 'lesson':
        return get().lessonsDone.includes(mapId);
      case 'drill':
        return license === 'permit' || license === 'licensed';
      case 'night':
        return get().nightsDone.includes(mapId);
      case 'boss':
        return license === 'licensed';
    }
  },

  isChapterUnlocked: (mapId) => {
    if (!chapterForMap(mapId)) {
      return false;
    }
    return mapId === 1 || get().isNodeDone(mapId - 1, 'boss');
  },

  nextNode: () => {
    for (const chapter of CHAPTERS) {
      if (!get().isChapterUnlocked(chapter.mapId)) {
        break; // chapters unlock strictly in order
      }
      for (const node of NODE_ORDER) {
        if (!get().isNodeDone(chapter.mapId, node)) {
          return { mapId: chapter.mapId, node };
        }
      }
    }
    return null;
  },

  isGraduated: () => CHAPTERS.every((chapter) => get().isNodeDone(chapter.mapId, 'boss')),

  hydrate: (data) =>
    set({
      lessonsDone: [...data.lessonsDone],
      nightsDone: [...data.nightsDone],
    }),
}));
