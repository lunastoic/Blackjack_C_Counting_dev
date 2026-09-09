import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import {
  DUCKED_VOLUME,
  METER_TOP_UP_CLIMBS,
  meterTopUpId,
  playSound,
  preloadSounds,
  releaseTableSounds,
  unloadSounds,
  warmTableSounds,
} from '../../services/audio/audioService';
import { soundRegistry } from '../../services/audio/registry';
import { METER_TOP_UP_STEPS, SoundId } from '../../services/audio/types';

const mockRemove = jest.fn();
/** Every player made, in creation order (the registry keeps its own map). */
const mockPlayers: MockPlayer[] = [];

interface MockPlayer {
  play: jest.Mock;
  seekTo: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  currentTime: number;
  duration: number;
  volume: number;
}

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const player: MockPlayer = {
      play: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      pause: jest.fn(),
      remove: mockRemove,
      currentTime: 0,
      duration: 0.5,
      volume: 1,
    };
    mockPlayers.push(player);
    return player;
  }),
}));

/** Lets an awaited rewind land (a resolved promise: one microtask, plus one to spare). */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** The drill sounds live from boot; the table's five load when a table opens. */
const RESIDENT_COUNT = 7;
const TABLE_COUNT = 5;
/** The climbing phrase stays sourced but unloaded while the climb is off. */
const SHELVED_COUNT = METER_TOP_UP_STEPS;

describe('audio registry', () => {
  it('sources every sound, including one top-up note per step of the phrase', () => {
    for (const source of Object.values(soundRegistry)) {
      expect(source).not.toBeNull();
    }
    for (let step = 1; step <= METER_TOP_UP_STEPS; step++) {
      expect(soundRegistry[`meterTopUp${step}` as SoundId]).toBeDefined();
    }
    expect(Object.keys(soundRegistry)).toHaveLength(RESIDENT_COUNT + TABLE_COUNT + SHELVED_COUNT);
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

  it('the top-up is the same chime on every straight right answer', () => {
    expect(METER_TOP_UP_CLIMBS).toBe(false);
    const notes = Array.from({ length: METER_TOP_UP_STEPS + 2 }, (_, combo) => meterTopUpId(combo));
    expect(new Set(notes)).toEqual(new Set(['meterTopUp']));
    expect(meterTopUpId(-3)).toBe('meterTopUp');
  });
});

describe('playing a sound', () => {
  // Players are created on first play, so in each test mockPlayers[n] is the
  // n-th distinct sound played.
  beforeEach(() => {
    unloadSounds();
    mockPlayers.length = 0;
    jest.clearAllMocks();
    jest.useFakeTimers({ now: 1_000_000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays a fresh player at once, without a rewind', () => {
    playSound('cardDeal');
    const [player] = mockPlayers;
    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('waits for the rewind before replaying a finished player', async () => {
    playSound('cardDeal');
    const [player] = mockPlayers;
    player.currentTime = player.duration;

    playSound('cardDeal');
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(1); // Not before the seek lands.
    await flush();
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it('plays the table noise under a ringing call, then at full volume again', () => {
    playSound('win');
    playSound('cardDeal');
    const [win, cardDeal] = mockPlayers;
    expect(win.volume).toBe(1);
    expect(cardDeal.volume).toBe(DUCKED_VOLUME);

    jest.setSystemTime(1_000_000 + 700); // 500 ms ring + the start latency.
    playSound('cardDeal');
    expect(cardDeal.volume).toBe(1);
    expect(mockPlayers).toHaveLength(2);
  });

  it('never ducks one call under another', () => {
    playSound('win');
    playSound('meterTopUp');
    const [, chime] = mockPlayers;
    expect(chime.volume).toBe(1);
  });
});
