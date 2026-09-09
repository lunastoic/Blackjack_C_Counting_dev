import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSettingsStore } from '../../stores/settingsStore';
import { soundRegistry } from './registry';
import { METER_TOP_UP_STEPS, MeterTopUpStep, SoundId } from './types';

/**
 * Central audio service. All gameplay/UI sound goes through here so the
 * sound-enabled setting is honored in exactly one place. Missing sources,
 * failed loads, and disabled sound all no-op without throwing.
 */

const players = new Map<SoundId, AudioPlayer>();

/**
 * Every sound is a short one-shot fired between taps, so the audio session
 * must stay up between them. By default expo-audio deactivates the iOS
 * session 100 ms after each sound ends and re-activates it on the next
 * play(): two synchronous AVAudioSession round-trips per sound, each of
 * which stalls the calling thread for tens of milliseconds — that was the
 * late plink and the stuttering card deal in the drills.
 */
const PLAYER_OPTIONS = { keepAudioSessionActive: true } as const;

/**
 * Game effects: sit alongside whatever the player is listening to and honor
 * the ring/silent switch (iOS "ambient"). Without this the session takes the
 * system default, which pauses the player's music every time a sound fires.
 */
const AUDIO_MODE = {
  playsInSilentMode: false,
  interruptionMode: 'mixWithOthers',
  shouldPlayInBackground: false,
} as const;

/**
 * Every player holds a native AVPlayer and its media threads (~1 MB each),
 * so only the sounds the app opens on — the drills — are created at boot.
 * The table's sounds are warmed when a table opens and are the ones released
 * again under memory pressure; either way a missing player is created on
 * first play, just a beat late.
 */
const RESIDENT_SOUNDS: readonly SoundId[] = [
  'cardDeal',
  'cardFlip',
  'win',
  'loss',
  'push',
  'shuffle',
  'meterTopUp1',
  'meterTopUp2',
  'meterTopUp3',
  'meterTopUp4',
  'meterTopUp5',
  'meterTopUp6',
  'meterTopUp7',
  'meterTopUp8',
];
const TABLE_SOUNDS: readonly SoundId[] = [
  'chipTap',
  'betPlaced',
  'levelUp',
  'achievementUnlock',
  'buttonTap',
];

function isEnabled(): boolean {
  return useSettingsStore.getState().soundEnabled;
}

function getOrCreatePlayer(id: SoundId): AudioPlayer | null {
  const existing = players.get(id);
  if (existing) {
    return existing;
  }
  const source = soundRegistry[id];
  if (source === null) {
    return null; // Sound not sourced yet — safe no-op.
  }
  try {
    const player = createAudioPlayer(source, PLAYER_OPTIONS);
    players.set(id, player);
    return player;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[audio] Failed to create player for "${id}":`, error);
    }
    return null;
  }
}

/** Configures the session and creates the players the app opens on (the drills). */
export function preloadSounds(): void {
  setAudioModeAsync(AUDIO_MODE).catch((error: unknown) => {
    if (__DEV__) {
      console.warn('[audio] Failed to set the audio mode:', error);
    }
  });
  for (const id of RESIDENT_SOUNDS) {
    getOrCreatePlayer(id);
  }
}

/** Creates the table's players ahead of the first chip tap. Idempotent. */
export function warmTableSounds(): void {
  for (const id of TABLE_SOUNDS) {
    getOrCreatePlayer(id);
  }
}

/** Releases the table's players (memory pressure); they come back on first play. */
export function releaseTableSounds(): void {
  for (const id of TABLE_SOUNDS) {
    const player = players.get(id);
    if (!player) {
      continue;
    }
    players.delete(id);
    try {
      player.remove();
    } catch {
      // Already released.
    }
  }
}

export function playSound(id: SoundId): void {
  if (!isEnabled()) {
    return;
  }
  try {
    const player = getOrCreatePlayer(id);
    if (player) {
      player.seekTo(0);
      player.play();
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(`[audio] Failed to play "${id}":`, error);
    }
  }
}

/**
 * The meter top-up note for the `combo`-th straight right answer (0-based):
 * each one climbs a step, wrapping back to the root after the phrase.
 */
export function meterTopUpId(combo: number): SoundId {
  const step = ((Math.max(0, Math.floor(combo)) % METER_TOP_UP_STEPS) + 1) as MeterTopUpStep;
  return `meterTopUp${step}`;
}

export function playMeterTopUp(combo: number): void {
  playSound(meterTopUpId(combo));
}

export function stopSound(id: SoundId): void {
  try {
    players.get(id)?.pause();
  } catch {
    // Stopping a released player is harmless.
  }
}

/** Releases all native players (app teardown / dev reset). */
export function unloadSounds(): void {
  for (const [, player] of players) {
    try {
      player.remove();
    } catch {
      // Already released.
    }
  }
  players.clear();
}
