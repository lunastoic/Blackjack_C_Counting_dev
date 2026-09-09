import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useSettingsStore } from '../../stores/settingsStore';
import { soundRegistry } from './registry';
import { METER_CLIMB_STEPS, MeterClimbStep, SoundId } from './types';

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
 * Shelved: the synthesized meter chimes followed the bar — a right answer
 * that lifted it to a quarter below full played that quarter's chime, each
 * a step higher, and one that landed on full played the home chime. The
 * drills answer with the picked pop now; these stay sourced but unloaded.
 */
const METER_CLIMB: readonly SoundId[] = Array.from(
  { length: METER_CLIMB_STEPS },
  (_, index) => `meterClimb${(index + 1) as MeterClimbStep}` as const,
);

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
  'answerRight',
  'answerWrong',
  'strikeOut',
];
const TABLE_SOUNDS: readonly SoundId[] = [
  'chipTap',
  'betPlaced',
  'levelUp',
  'achievementUnlock',
  'buttonTap',
];

/**
 * The house's calls — a result, a right answer, a level — lead the mix: the
 * table noise (cards, chips, buttons) that lands while one is still ringing
 * plays under it at DUCKED_VOLUME instead of drowning its tail, which is
 * what made the win read as cut off when the next hand dealt over it.
 */
const LEAD_SOUNDS: ReadonlySet<SoundId> = new Set<SoundId>([
  'win',
  'loss',
  'push',
  'levelUp',
  'achievementUnlock',
  'answerRight',
  'answerWrong',
  'strikeOut',
  'meterTopUp',
  ...METER_CLIMB,
]);
export const DUCKED_VOLUME = 0.35;

/**
 * The picked SFX are mastered near full scale, four to seven times the
 * level of the synthesized placeholders they sit among, so they play at a
 * gain that lands them at the same loudness. Unlisted sounds play at 1.
 */
export const SOUND_GAIN: Readonly<Partial<Record<SoundId, number>>> = {
  answerRight: 0.4,
  answerWrong: 0.3125, // 0.25, up a quarter
  strikeOut: 0.7, // down 30%
};
/** Fallback ring time for a lead sound whose player has not loaded yet. */
const UNKNOWN_LEAD_MS = 500;
/** Sounds start a beat after play() on device; the ring is padded to match. */
const START_LATENCY_MS = 80;
let leadRingsUntil = 0;

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
  const player = getOrCreatePlayer(id);
  if (!player) {
    return;
  }
  void restart(id, player);
}

/**
 * Mixes, rewinds, and plays. A player that has finished sits at its end,
 * and the rewind is asynchronous on iOS — play() issued in the same tick
 * raced it and lost every other time, leaving that card or call silent —
 * so the rewind is awaited (a millisecond or two on a local file). An
 * unplayed or already-rewound player skips straight to play().
 */
async function restart(id: SoundId, player: AudioPlayer): Promise<void> {
  try {
    const now = Date.now();
    const gain = SOUND_GAIN[id] ?? 1;
    if (LEAD_SOUNDS.has(id)) {
      const ringMs = player.duration > 0 ? player.duration * 1000 : UNKNOWN_LEAD_MS;
      leadRingsUntil = Math.max(leadRingsUntil, now + START_LATENCY_MS + ringMs);
      player.volume = gain;
    } else {
      player.volume = leadRingsUntil > now ? gain * DUCKED_VOLUME : gain;
    }
    if (player.currentTime > 0) {
      await player.seekTo(0);
    }
    player.play();
  } catch (error) {
    if (__DEV__) {
      console.warn(`[audio] Failed to play "${id}":`, error);
    }
  }
}

/**
 * Shelved with the chimes: the chime for a right answer, from where the
 * meter stands once topped up (0–1): home at full, else the quarter the bar
 * reaches.
 */
export function meterTopUpId(fill: number): SoundId {
  if (!(fill < 1)) {
    return 'meterTopUp';
  }
  // A hair under the exact quarters so 0.25 + 0.25 lands on 2, not 3.
  const quarter = Math.ceil(fill * METER_CLIMB_STEPS - 1e-6);
  const step = Math.min(METER_CLIMB_STEPS, Math.max(1, quarter)) as MeterClimbStep;
  return `meterClimb${step}`;
}

export function playMeterTopUp(fill: number): void {
  playSound(meterTopUpId(fill));
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
  leadRingsUntil = 0;
}


