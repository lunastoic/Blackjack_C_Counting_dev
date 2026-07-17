import { create } from 'zustand';
import { DEFAULT_DISPLAY_NAME, MAX_DISPLAY_NAME_LENGTH, SaveData } from '../persistence/schema';

/**
 * One local player profile per installed device. No accounts, no backend.
 */
interface ProfileState {
  readonly displayName: string;
  readonly createdAt: number | null;
  /** Trims, caps length, and falls back to the default name when empty. */
  setDisplayName(raw: string): void;
  hydrate(data: SaveData['profile']): void;
}

export function sanitizeDisplayName(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : DEFAULT_DISPLAY_NAME;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  displayName: DEFAULT_DISPLAY_NAME,
  createdAt: null,
  setDisplayName: (raw) =>
    set((state) => ({
      displayName: sanitizeDisplayName(raw),
      createdAt: state.createdAt ?? Date.now(),
    })),
  hydrate: (data) => set({ displayName: data.displayName, createdAt: data.createdAt }),
}));
