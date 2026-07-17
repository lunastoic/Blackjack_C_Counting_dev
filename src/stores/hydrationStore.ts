import { create } from 'zustand';

/**
 * Tracks app bootstrap. Screens render behind a LoadingGate until
 * `hasHydrated` is true, so default values are never flashed before the
 * persisted save has been applied.
 */
interface HydrationState {
  readonly hasHydrated: boolean;
  readonly isHydrating: boolean;
  /** Non-null when the save was recovered from corrupt data (defaults applied). */
  readonly hydrationError: string | null;
  markHydrating(): void;
  markHydrated(error: string | null): void;
  reset(): void;
}

export const useHydrationStore = create<HydrationState>()((set) => ({
  hasHydrated: false,
  isHydrating: false,
  hydrationError: null,
  markHydrating: () => set({ isHydrating: true, hydrationError: null }),
  markHydrated: (error) => set({ hasHydrated: true, isHydrating: false, hydrationError: error }),
  reset: () => set({ hasHydrated: false, isHydrating: false, hydrationError: null }),
}));
