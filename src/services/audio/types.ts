/** Every sound the game will eventually play. */
export type SoundId =
  | 'cardDeal'
  | 'cardFlip'
  | 'chipTap'
  | 'betPlaced'
  | 'win'
  | 'loss'
  | 'push'
  | 'levelUp'
  | 'achievementUnlock'
  | 'shuffle'
  | 'buttonTap'
  | `meterTopUp${MeterTopUpStep}`;

/** The meter top-up climbs a pentatonic phrase: one note per step. */
export type MeterTopUpStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const METER_TOP_UP_STEPS = 8;

/** Static require() result, or null while the sound file has not been sourced. */
export type SoundSource = number | null;
