import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import {
  meterTopUpId,
  preloadSounds,
  releaseTableSounds,
  warmTableSounds,
} from '../../services/audio/audioService';
import { soundRegistry } from '../../services/audio/registry';
import { METER_TOP_UP_STEPS, SoundId } from '../../services/audio/types';

const mockRemove = jest.fn();

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    seekTo: jest.fn(),
    pause: jest.fn(),
    remove: mockRemove,
  })),
}));

/** The drill sounds live from boot; the table's five load when a table opens. */
const RESIDENT_COUNT = 14;
const TABLE_COUNT = 5;

describe('audio registry', () => {
  it('sources every sound, including one top-up note per step of the phrase', () => {
    for (const source of Object.values(soundRegistry)) {
      expect(source).not.toBeNull();
    }
    for (let step = 1; step <= METER_TOP_UP_STEPS; step++) {
      expect(soundRegistry[`meterTopUp${step}` as SoundId]).toBeDefined();
    }
    expect(Object.keys(soundRegistry)).toHaveLength(RESIDENT_COUNT + TABLE_COUNT);
  });

  it('boots with the drill sounds only and keeps the audio session up between one-shots', () => {
    preloadSounds();
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    expect(createAudioPlayer).toHaveBeenCalledTimes(RESIDENT_COUNT);
    for (const [, options] of (createAudioPlayer as jest.Mock).mock.calls) {
      expect(options).toEqual({ keepAudioSessionActive: true });
    }
  });

  it('warms the table sounds once and releases them again under memory pressure', () => {
    warmTableSounds();
    warmTableSounds();
    expect(createAudioPlayer).toHaveBeenCalledTimes(RESIDENT_COUNT + TABLE_COUNT);

    releaseTableSounds();
    expect(mockRemove).toHaveBeenCalledTimes(TABLE_COUNT);

    // The resident set survives; the table set comes back on the next warm-up.
    warmTableSounds();
    expect(createAudioPlayer).toHaveBeenCalledTimes(RESIDENT_COUNT + 2 * TABLE_COUNT);
  });

  it('the top-up climbs a note per straight right answer and wraps after the phrase', () => {
    const notes = Array.from({ length: METER_TOP_UP_STEPS + 2 }, (_, combo) => meterTopUpId(combo));
    expect(notes).toEqual([
      'meterTopUp1', 'meterTopUp2', 'meterTopUp3', 'meterTopUp4',
      'meterTopUp5', 'meterTopUp6', 'meterTopUp7', 'meterTopUp8',
      'meterTopUp1', 'meterTopUp2',
    ]);
    expect(meterTopUpId(-3)).toBe('meterTopUp1');
  });
});
