import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import {
  DUCKED_VOLUME,
  meterTopUpId,
  playSound,
  preloadSounds,
  releaseTableSounds,
  SOUND_GAIN,
  unloadSounds,
  warmTableSounds,
} from '../../services/audio/audioService';
import { soundRegistry } from '../../services/audio/registry';
import { METER_CLIMB_STEPS, METER_TOP_UP_STEPS, SoundId } from '../../services/audio/types';

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
const RESIDENT_COUNT = 6 + 3;
const TABLE_COUNT = 5;
/** The meter chimes and the older plink phrase stay sourced but are never loaded. */
const SHELVED_COUNT = 1 + METER_CLIMB_STEPS + METER_TOP_UP_STEPS;

describe('audio registry', () => {
  it('sources every sound, the picked drill SFX and the shelved chimes included', () => {
    for (const source of Object.values(soundRegistry)) {
      expect(source).not.toBeNull();
    }
    for (const id of ['answerRight', 'answerWrong', 'strikeOut'] as const) {
      expect(soundRegistry[id]).toBeDefined();
    }
    for (let step = 1; step <= METER_CLIMB_STEPS; step++) {
      expect(soundRegistry[`meterClimb${step}` as SoundId]).toBeDefined();
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

  it('chimes the quarter the meter reaches, and home once it is full', () => {
    // A refill from empty: three steps up, then home on the fourth.
    expect([0.25, 0.5, 0.75, 1].map(meterTopUpId)).toEqual([
      'meterClimb1',
      'meterClimb2',
      'meterClimb3',
      'meterTopUp',
    ]);
    // Between the quarters (the bar drains between answers).
    expect(meterTopUpId(0.35)).toBe('meterClimb2');
    expect(meterTopUpId(0.85)).toBe('meterClimb4');
    expect(meterTopUpId(0.999)).toBe('meterClimb4');
    // Already full, or something odd: home.
    expect(meterTopUpId(1.2)).toBe('meterTopUp');
    expect(meterTopUpId(Number.NaN)).toBe('meterTopUp');
    expect(meterTopUpId(0)).toBe('meterClimb1');
    // Exact quarter sums never round up a step.
    expect(meterTopUpId(0.1 + 0.2 + 0.2)).toBe('meterClimb2');
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

  it('plays the picked SFX at their gain, ducked from there when they are table noise', () => {
    playSound('answerRight');
    playSound('answerWrong');
    const [pop, error] = mockPlayers;
    expect(pop.volume).toBe(SOUND_GAIN.answerRight);
    expect(error.volume).toBe(SOUND_GAIN.answerWrong); // A call, never ducked.
    expect(SOUND_GAIN.answerRight).toBeLessThan(1);
  });
});
