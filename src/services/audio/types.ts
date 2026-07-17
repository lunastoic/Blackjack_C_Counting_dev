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
  | 'buttonTap';

/** Static require() result, or null while the sound file has not been sourced. */
export type SoundSource = number | null;
