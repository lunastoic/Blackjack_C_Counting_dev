/**
 * Central animation durations (ms). Gameplay timings scale with the
 * dealer-speed setting in later milestones; UI timings do not.
 */
export const durations = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  // Gameplay baselines from REBUILD_SPEC §10 (scaled by dealerSpeed later)
  cardTravel: 500,
  cardFlip: 260,
  /** Full discard+shoe gather → wash → return-to-deck ceremony. */
  shoeShuffle: 2600,
  /** Zoom/settle when Deal sits the player at the table. */
  tableSit: 720,
} as const;

/** Z-index layers so overlays never fight each other. */
export const layers = {
  base: 0,
  raised: 10,
  header: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
} as const;
