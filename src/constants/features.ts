/**
 * Feature flags — the product's "circuit breakers".
 *
 * v1 ships ONE focused story: learn to count in the Count Sprint, earn your
 * table license, cash in at the table with the fogged count meter. Everything
 * that competed with that story is DISABLED here, not deleted — flip a flag
 * back to true and the old feature returns, code and tests intact.
 */
export const FEATURES = {
  /**
   * The Count Coach dial (Off / Learn / Full) in settings and the ≡ menu.
   * Disabled: every table runs the Learn experience — the fogged "?" meter
   * with tap-to-reveal — with no mode choice to explain. Full-coach tools
   * (live counts, strategy/distribution charts, count pulse, underglow
   * toggles, the autoplay drill) all hang off this dial and go dormant
   * with it.
   */
  countCoachDial: false,

  /**
   * Level-based casino unlocks (reach level N, tap to unlock).
   * Disabled: casinos unlock by finishing the PREVIOUS casino's Count
   * Sprint license — one ladder, one story. Levels still pay chip rewards.
   */
  levelMapGating: false,

  /**
   * The coach's own post-round Count Check (pops every round until a streak
   * builds, then on a stretching cadence).
   * Disabled: the table never interrupts play. The only Count Check is the
   * one the player asks for by tapping the fogged meter between hands.
   * The cadence engine, streak XP and their tests stay intact behind this.
   */
  autoCountChecks: false,
} as const;
