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
   * The Count Coach dial (Off / Learn / Full) — the felt tab, settings and
   * the ≡ menu. Enabled: the dial alone decides what the table shows (Off:
   * clean table; Learn: the fogged "?" meter with tap-to-reveal; Full: live
   * counts, glows, strategy hints and card charts).
   * Disabled: the felt's on/off Training switch decides instead — on is
   * Full, off is Learn — and the dial UI goes dormant.
   */
  countCoachDial: true,

  /**
   * The four per-aid switches (Card underglow, Strategy hints, Count pulse,
   * Distribution charts) plus the Training on/off switch in settings.
   * Disabled: the Count Coach dial is the only control — Full turns the
   * underglow, hints and charts on together and the count pulse stays off.
   * The stored `trainingAids` still persist untouched for when this returns.
   */
  trainingAidToggles: false,

  /**
   * Full coach swaps in the "training" card faces printed with Hi-Lo values.
   * Disabled: every table deals the regular faces whatever the dial says.
   */
  trainingCardSkin: false,

  /**
   * The "Start autoplay drill" link on the betting panel under Full coach.
   * Disabled: the drill and its store logic stay intact, just no entry point.
   */
  autoplayDrill: false,

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

  /**
   * The globe's 3D "Casinos" fan floating over the live table.
   * Disabled: the globe opens the Select Map screen instead — every casino's
   * level ladder with the table button along the bottom of its card.
   */
  casinoFan: false,

  /**
   * The "Quiz" pill under a cleared casino's name on the Select Map card.
   * Disabled: the banner stays one line so the ladder and the Play Table
   * button get the room. Note: with the fan off too, Quiz mode has no entry
   * point until one of these flags returns.
   */
  mapCardQuiz: false,
} as const;
