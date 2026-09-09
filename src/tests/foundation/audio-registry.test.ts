import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { meterTopUpId, preloadSounds } from '../../services/audio/audioService';
import { soundRegistry } from '../../services/audio/registry';
import { METER_TOP_UP_STEPS, SoundId } from '../../services/audio/types';

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    seekTo: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
  })),
}));

describe('audio registry', () => {
  it('sources every sound, including one top-up note per step of the phrase', () => {
    for (const source of Object.values(soundRegistry)) {
      expect(source).not.toBeNull();
    }
    for (let step = 1; step <= METER_TOP_UP_STEPS; step++) {
      expect(soundRegistry[`meterTopUp${step}` as SoundId]).toBeDefined();
    }
  });

  it('preloads one player per sound and keeps the audio session up between one-shots', () => {
    preloadSounds();
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    const sourced = Object.values(soundRegistry).filter((source) => source !== null).length;
    expect(createAudioPlayer).toHaveBeenCalledTimes(sourced);
    for (const [, options] of (createAudioPlayer as jest.Mock).mock.calls) {
      expect(options).toEqual({ keepAudioSessionActive: true });
    }
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
