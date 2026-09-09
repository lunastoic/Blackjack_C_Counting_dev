import { Image } from 'expo-image';
import { AppState } from 'react-native';
import {
  __resetMemoryServiceForTests,
  configureImageMemory,
  subscribeToMemoryWarnings,
} from '../../services/memory/memoryService';

const mockReleaseTableSounds = jest.fn();

jest.mock('expo-image', () => ({
  Image: {
    configureCache: jest.fn(),
    clearMemoryCache: jest.fn(() => Promise.resolve(true)),
  },
}));
jest.mock('../../services/audio', () => ({
  releaseTableSounds: () => mockReleaseTableSounds(),
}));

describe('memory service', () => {
  const listeners: (() => void)[] = [];
  const remove = jest.fn();

  beforeEach(() => {
    listeners.length = 0;
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listeners.push(handler as () => void);
      return { remove };
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    __resetMemoryServiceForTests();
    jest.restoreAllMocks();
  });

  it('caps the decoded-image cache at boot', () => {
    configureImageMemory();
    expect(Image.configureCache).toHaveBeenCalledWith({ maxMemoryCost: 48 * 1024 * 1024 });
  });

  it('subscribes to the OS memory warning exactly once', () => {
    subscribeToMemoryWarnings();
    subscribeToMemoryWarnings();
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    expect(AppState.addEventListener).toHaveBeenCalledWith('memoryWarning', expect.any(Function));
  });

  it('drops the image cache and the table players when iOS warns', () => {
    subscribeToMemoryWarnings();
    listeners[0]?.();
    expect(Image.clearMemoryCache).toHaveBeenCalledTimes(1);
    expect(mockReleaseTableSounds).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on teardown', () => {
    subscribeToMemoryWarnings();
    __resetMemoryServiceForTests();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
