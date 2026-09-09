import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { useSettingsStore } from '../../stores/settingsStore';
import { soundRegistry } from './registry';
import { METER_TOP_UP_STEPS, MeterTopUpStep, SoundId } from './types';

/**
 * Central audio service. All gameplay/UI sound goes through here so the
 * sound-enabled setting is honored in exactly one place. Missing sources,
 * failed loads, and disabled sound all no-op without throwing.
 */

const players = new Map<SoundId, AudioPlayer>();

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
    const player = createAudioPlayer(source);
    players.set(id, player);
    return player;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[audio] Failed to create player for "${id}":`, error);
    }
    return null;
  }
}

/** Eagerly creates players for every registered (non-null) sound. */
export function preloadSounds(): void {
  for (const id of Object.keys(soundRegistry) as SoundId[]) {
    getOrCreatePlayer(id);
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
