import { Image } from 'expo-image';
import { AppState, NativeEventSubscription, Platform } from 'react-native';
import { releaseTableSounds } from '../audio';

/**
 * Memory hygiene. Every bitmap on screen goes through expo-image, which
 * decodes each asset at the size of the view showing it and shares one
 * decoded copy between views. The posters and felts are 1536×1024 (6 MB each
 * decoded at full size) and the card faces 500×700, so this is where the
 * footprint lives; the budget below caps what stays resident between screens.
 */

/** Decoded-bitmap cache budget: roomy for a table and a level map, not a whole tour. */
const IMAGE_MEMORY_BUDGET_BYTES = 48 * 1024 * 1024;

let subscription: NativeEventSubscription | null = null;

/** Sizes the image cache. Idempotent; iOS-only (Android sizes its own). */
export function configureImageMemory(): void {
  if (Platform.OS !== 'ios') {
    return;
  }
  try {
    Image.configureCache({ maxMemoryCost: IMAGE_MEMORY_BUDGET_BYTES });
  } catch (error) {
    if (__DEV__) {
      console.warn('[memory] Failed to configure the image cache:', error);
    }
  }
}

/**
 * When iOS warns, drop every decoded bitmap that is not on screen instead of
 * waiting to be killed; views re-decode what they still show. Idempotent.
 */
export function subscribeToMemoryWarnings(): void {
  if (subscription !== null) {
    return;
  }
  subscription = AppState.addEventListener('memoryWarning', releaseMemory);
}

/** Frees every cache the app can rebuild on demand. */
export function releaseMemory(): void {
  if (__DEV__) {
    console.warn('[memory] Low-memory warning: clearing the image cache');
  }
  Image.clearMemoryCache().catch(() => {
    // Nothing to clear yet.
  });
  releaseTableSounds();
}

/** Test-only teardown. */
export function __resetMemoryServiceForTests(): void {
  subscription?.remove();
  subscription = null;
}
