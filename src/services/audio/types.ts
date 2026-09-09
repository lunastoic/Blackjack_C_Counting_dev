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
  | 'answerRight'
  | 'answerWrong'
  | 'strikeOut'
  | 'meterTopUp'
  | `meterClimb${MeterClimbStep}`
  | `meterTopUp${MeterTopUpStep}`;

/**
 * Shelved: the synthesized meter chimes — `meterTopUp` was home (the bar
 * full) and the climb one chime per quarter the bar reaches below full, each
 * a step higher. The drills now answer with the picked `answerRight` pop.
 */
export type MeterClimbStep = 1 | 2 | 3 | 4;
export const METER_CLIMB_STEPS = 4;

/** Shelved: the older plink phrase, one note per straight right answer. Unused. */
export type MeterTopUpStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const METER_TOP_UP_STEPS = 8;

/** Static require() result, or null while the sound file has not been sourced. */
export type SoundSource = number | null;
