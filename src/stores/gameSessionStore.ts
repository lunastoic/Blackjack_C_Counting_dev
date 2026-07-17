import { create } from 'zustand';
import { GameplayEvent } from '../engine/achievements/events';
import { CasinoMap, mapById } from '../engine/betting/casino';
import { isValidBet } from '../engine/betting/bets';
import { ACTION_COOLDOWN_MS } from '../engine/blackjack/constants';
import { canDouble, canSplit, GameMode, PlayerAction } from '../engine/blackjack/rules';
import {
  applyPlayerAction,
  IllegalActionError,
  playDealerTurn,
  RoundEvent,
  RoundState,
  startRound,
} from '../engine/blackjack/round';
import { activeHand as engineActiveHand } from '../engine/blackjack/round';
import { resolveRound, RoundResolution } from '../engine/blackjack/resolve';
import { recommendForHand } from '../engine/strategy/recommend';
import { hiLoValue } from '../engine/counting/hiLo';
import { trueCount } from '../engine/counting/trueCount';
import { xpForHandResult } from '../engine/progression/progression';
import { RoundPayout, settleRound } from '../engine/payouts/payouts';
import {
  cardsRemaining,
  createShoe,
  DeckCount,
  EmptyShoeError,
  isShufflePending,
  Shoe,
} from '../engine/shoe/shoe';
import { RoundPhase } from '../engine/state-machine/phases';
import { transition } from '../engine/state-machine/machine';
import {
  countEventForInitialDealStep,
  INITIAL_DEAL_CARD_COUNT,
} from '../utils/dealSequence';
import { durations } from '../theme';
import { useEconomyStore } from './economyStore';
import { useModeStatsStore } from './modeStatsStore';
import { useSettingsStore, clampDealerSpeed } from './settingsStore';
import { awardXpWithRewards, recordGameplayEvent, XpAwardOutcome } from './orchestration';

/**
 * Connects the pure engine to the UI for one table session. The engine phase
 * machine is the single source of truth; every UI state (buttons, banners,
 * dealer pacing) derives from `phase`.
 *
 * TIMING: dealer reveals, resolution pauses, and cleanup all run through
 * `schedule()` timers scaled by the dealer-speed setting (0.5×–2.0×). The
 * running count updates ONLY when the store processes a visibility event —
 * never from animation callbacks.
 *
 * TRANSIENT: nothing here persists. Leaving mid-round refunds all live bets
 * (see endSession), so an interrupted round restarts safely at betting.
 */

export interface LevelUpNotice {
  readonly level: number;
  readonly chipReward: number;
}

interface GameSessionState {
  readonly sessionActive: boolean;
  readonly map: CasinoMap | null;
  readonly mode: GameMode;
  readonly phase: RoundPhase;
  readonly shoe: Shoe | null;
  readonly round: RoundState | null;
  /** Chips in the bet circle before dealing (already deducted from economy). */
  readonly wager: number;
  readonly runningCount: number;
  /** True while the current shoe passed penetration → shuffle after this round. */
  readonly shufflePending: boolean;
  /**
   * Cards already drawn from the shoe but not yet shown on the table (the
   * dealer's paced reveal). True count and "cards left" add these back so the
   * on-screen numbers always describe what the player can actually see.
   */
  readonly pendingReveals: number;
  /** Set during the shuffling phase so the UI can announce the reset. */
  readonly justShuffled: boolean;
  readonly resolution: RoundResolution | null;
  readonly payout: RoundPayout | null;
  readonly xpAwarded: number;
  readonly levelUpNotice: LevelUpNotice | null;
  readonly lastActionAt: number;
  /** Training autoplay drill: bot plays basic strategy with nothing at stake. */
  readonly autoplay: boolean;
  /** True while the CURRENT round belongs to the autoplay drill. */
  readonly isAutoplayRound: boolean;
  /** Drill-only pacing (0.5×–2.0×); does not change global dealer speed. */
  readonly autoplaySpeed: number;
  /**
   * Initial deal animation progress (0 = none yet, 1–4 = cards on the felt).
   * Only meaningful while `phase === 'dealing'`.
   */
  readonly initialDealStep: number;

  startSession(mapId: number, mode: GameMode): boolean;
  endSession(): void;
  startAutoplay(): boolean;
  /** Stops after the current hand finishes (mid-round autoplay keeps playing it out). */
  stopAutoplay(): void;
  /** Adjust drill speed while autoplay is active (0.5×–2.0×). */
  setAutoplaySpeed(speed: number): void;

  addChipToBet(chipValue: number): boolean;
  returnBet(): void;
  redoBet(): void;
  deal(): boolean;

  act(action: PlayerAction): boolean;
  canAct(action: PlayerAction): boolean;

  /** True count derived from the live shoe (rounded to nearest 0.5). */
  getTrueCount(): number;
  /** Cards remaining as the player perceives them (excludes unrevealed dealer draws). */
  getCardsRemainingVisible(): number;
  dismissLevelUp(): void;
  /**
   * When the player changes deck count for this session's mode: reshuffle
   * immediately between hands (betting), or after the current round finishes.
   * Always resets the running count when the shoe is rebuilt.
   */
  applyDeckCountChange(mode: GameMode): void;
}

/** Nominal bet used only so engine hands exist during the stake-free autoplay drill. */
const AUTOPLAY_NOMINAL_BET = 10;

/** Base pacing (ms) at 1.0× dealer speed. */
const BASE_DELAYS = {
  dealCard: 550, // one card at a time in the opening deal (player/dealer alternation)
  dealFinish: 350, // brief pause after the fourth card before player turn
  dealerStep: 700, // between dealer reveals/draws
  resolutionPause: 600, // dealer done → results banner
  payoutBanner: 1800, // results banner on screen
  collect: 700, // cards sliding away
  shuffleNotice: 1200, // "shuffling" message
} as const;

const timers = new Set<ReturnType<typeof setTimeout>>();

function clearAllTimers(): void {
  for (const timer of timers) {
    clearTimeout(timer);
  }
  timers.clear();
}

function schedule(fn: () => void, delay: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, delay);
  timers.add(timer);
}

function newShoe(mode: GameMode): Shoe {
  const deckCount: DeckCount = useSettingsStore.getState().deckCounts[mode];
  return createShoe(deckCount);
}

/** Sum of hi-lo values for the cards in a list of visibility events. */
function countDelta(events: readonly RoundEvent[]): number {
  let delta = 0;
  for (const event of events) {
    if (event.type === 'cardBecameVisible') {
      delta += hiLoValue(event.card.rank);
    }
  }
  return delta;
}

export const useGameSessionStore = create<GameSessionState>()((set, get) => {
  function scaledDelay(base: number): number {
    const { dealerSpeed, reducedMotion } = useSettingsStore.getState();
    const { autoplay, isAutoplayRound, autoplaySpeed } = get();
    const speed = autoplay || isAutoplayRound ? autoplaySpeed : dealerSpeed;
    if (reducedMotion) {
      return Math.min(300, base / 2);
    }
    return Math.round(base / speed);
  }

  /** Applies count changes and reports the new count to the achievement engine. */
  function applyCountEvents(events: readonly RoundEvent[]): void {
    const delta = countDelta(events);
    if (delta === 0 && events.every((e) => e.type !== 'cardBecameVisible')) {
      return;
    }
    const runningCount = get().runningCount + delta;
    set({ runningCount });
    if (!get().isAutoplayRound) {
      recordGameplayEvent({ type: 'COUNT_REACHED', runningCount }, get().map?.id);
    }
  }

  function recordMapEvent(event: GameplayEvent): void {
    recordGameplayEvent(event, get().map?.id);
  }

  function toPhase(to: RoundPhase): void {
    set({ phase: transition(get().phase, to) });
  }

  /** dealer reveals exhausted (or natural short-circuit) → resolve → pay → collect. */
  function resolveAndSettle(): void {
    const { round } = get();
    if (!round) {
      return;
    }
    toPhase('resolution');
    const resolution = resolveRound(round);
    set({ resolution });

    schedule(() => {
      toPhase('payout');

      // Autoplay drill: nothing at stake — no chips, XP, stats, or events.
      // Result badges still render from `resolution`; the banner stays hidden.
      if (get().isAutoplayRound) {
        set({ payout: null, xpAwarded: 0 });
        schedule(collectRound, scaledDelay(BASE_DELAYS.collect));
        return;
      }

      const payout = settleRound(resolution);
      if (payout.totalReturned > 0) {
        useEconomyStore.getState().creditChips(payout.totalReturned);
      }

      // XP + achievements per hand (+ persisted Regular Mode stats).
      const isRegular = get().mode === 'regular';
      let totalXp = 0;
      for (let i = 0; i < resolution.hands.length; i++) {
        const hand = resolution.hands[i];
        totalXp += xpForHandResult(hand.result);
        if (isRegular) {
          useModeStatsStore
            .getState()
            .recordRegularHand(hand.result, payout.hands[i]?.profit ?? 0);
        }
        recordMapEvent({
          type: 'HAND_COMPLETED',
          result: hand.result,
          wasSplitHand: hand.wasSplitHand,
          wasDoubled: hand.wasDoubled,
          playerBusted: hand.playerBusted,
        });
        if (hand.result === 'blackjack') {
          recordMapEvent({ type: 'BLACKJACK_HIT' });
        }
        if (hand.playerBusted) {
          recordMapEvent({ type: 'PLAYER_BUST' });
        }
        if (hand.result === 'win' && resolution.dealerBusted) {
          recordMapEvent({ type: 'DEALER_BUST_WIN' });
        }
      }
      const outcome: XpAwardOutcome = awardXpWithRewards(totalXp);
      set({
        payout,
        xpAwarded: totalXp,
        levelUpNotice:
          outcome.progression.levelsGained > 0
            ? {
                level: outcome.progression.newLevel,
                chipReward: outcome.progression.chipReward,
              }
            : null,
      });

      schedule(collectRound, scaledDelay(BASE_DELAYS.payoutBanner));
    }, scaledDelay(BASE_DELAYS.resolutionPause));
  }

  function collectRound(): void {
    toPhase('collecting');
    schedule(() => {
      const { shoe, mode } = get();
      const settingsDecks = useSettingsStore.getState().deckCounts[mode];
      const needsShuffle =
        !shoe || isShufflePending(shoe) || shoe.deckCount !== settingsDecks;

      if (needsShuffle) {
        // Clear the felt but keep the spent shoe so discard + remaining cards
        // stay visible for the gather → wash → restack ceremony.
        toPhase('shuffling');
        set({
          justShuffled: true,
          round: null,
          resolution: null,
          payout: null,
          wager: 0,
          isAutoplayRound: false,
          initialDealStep: 0,
        });
        schedule(() => {
          set({
            shoe: newShoe(mode),
            runningCount: 0,
            shufflePending: false,
          });
          toPhase('betting');
          resumeAutoplayIfActive();
          schedule(() => set({ justShuffled: false }), 1400);
        }, durations.shoeShuffle);
      } else {
        toPhase('betting');
        set({
          round: null,
          resolution: null,
          payout: null,
          wager: 0,
          isAutoplayRound: false,
          initialDealStep: 0,
        });
        resumeAutoplayIfActive();
      }
    }, scaledDelay(BASE_DELAYS.collect));
  }

  function resumeAutoplayIfActive(): void {
    if (get().autoplay && get().sessionActive) {
      schedule(autoDeal, scaledDelay(BASE_DELAYS.collect));
    }
  }

  /**
   * Opening deal: player → dealer hole → player → dealer up, one card per
   * beat. Count events fire only when each face-up card lands.
   */
  function runInitialDealSequence(
    step: { round: RoundState; shoe: Shoe; events: readonly RoundEvent[] },
    shortCircuit: boolean,
    onComplete: () => void,
  ): void {
    const advance = (dealStep: number): void => {
      set({ initialDealStep: dealStep });
      const countEvent = countEventForInitialDealStep(step.events, dealStep);
      if (countEvent) {
        applyCountEvents([countEvent]);
      }
      if (dealStep < INITIAL_DEAL_CARD_COUNT) {
        schedule(() => advance(dealStep + 1), scaledDelay(BASE_DELAYS.dealCard));
        return;
      }
      set({ initialDealStep: INITIAL_DEAL_CARD_COUNT });
      schedule(onComplete, scaledDelay(BASE_DELAYS.dealFinish));
    };
    schedule(() => advance(1), scaledDelay(50));
  }

  /** Stake-free autoplay deal: no chips are moved and no events are recorded. */
  function autoDeal(): void {
    const { autoplay, sessionActive, phase, shoe } = get();
    if (!autoplay || !sessionActive || phase !== 'betting' || !shoe) {
      return;
    }
    let step;
    try {
      step = startRound(AUTOPLAY_NOMINAL_BET, shoe);
    } catch (error) {
      if (error instanceof EmptyShoeError) {
        set({ shoe: newShoe(get().mode), runningCount: 0, shufflePending: false });
        resumeAutoplayIfActive();
        return;
      }
      throw error;
    }
    set({
      phase: transition('betting', 'dealing'),
      round: step.round,
      shoe: step.shoe,
      isAutoplayRound: true,
      initialDealStep: 0,
      resolution: null,
      payout: null,
      xpAwarded: 0,
      shufflePending: isShufflePending(step.shoe),
    });

    const shortCircuit = step.events.some((e) => e.type === 'playerTurnComplete');
    runInitialDealSequence(step, shortCircuit, () => {
      if (shortCircuit) {
        shortCircuitNatural();
      } else {
        toPhase('playerTurn');
        schedule(autoAct, scaledDelay(BASE_DELAYS.dealerStep));
      }
    });
  }

  /** The bot plays the active hand by basic strategy (affordability is moot). */
  function autoAct(): void {
    const { round, shoe, phase, isAutoplayRound } = get();
    if (!isAutoplayRound || phase !== 'playerTurn' || !round || !shoe) {
      return;
    }
    const hand = engineActiveHand(round);
    const dealerUp = round.dealerHand.cards[1];
    if (!hand || !dealerUp) {
      return;
    }
    const recommendation = recommendForHand(hand, dealerUp.rank, {
      canDouble: canDouble(hand),
      canSplit: canSplit(hand, round.splitUsed),
    });

    let step;
    try {
      step = applyPlayerAction(round, shoe, recommendation.preferredAction);
    } catch (error) {
      if (error instanceof IllegalActionError || error instanceof EmptyShoeError) {
        // Extremely defensive: stand the hand out rather than stall the drill.
        step = applyPlayerAction(round, shoe, 'stand');
      } else {
        throw error;
      }
    }

    set({ round: step.round, shoe: step.shoe });
    applyCountEvents(step.events);

    if (step.events.some((e) => e.type === 'playerTurnComplete')) {
      schedule(runDealerSequence, scaledDelay(BASE_DELAYS.dealerStep));
    } else {
      schedule(autoAct, scaledDelay(BASE_DELAYS.dealerStep));
    }
  }

  /** Reveals the hole card / dealer draws one at a time, paced by dealer speed. */
  function runDealerSequence(): void {
    const { round, shoe } = get();
    if (!round || !shoe) {
      return;
    }
    toPhase('dealerTurn');

    // The engine computes the full dealer turn at once; the store replays its
    // events stepwise so the table (and the count) update card by card.
    // `pendingReveals` counts the drawn-but-unshown cards so true count and
    // "cards left" stay consistent with what is visible during the reveal.
    // (The hole card was already drawn at the deal, so it is not pending.)
    const final = playDealerTurn(round, shoe);
    const drawsToReveal = final.events.filter(
      (e) => e.type === 'cardBecameVisible' && e.source === 'dealerDraw',
    ).length;
    set({
      shoe: final.shoe,
      shufflePending: isShufflePending(final.shoe),
      pendingReveals: drawsToReveal,
    });

    const steps = final.events;
    let stepIndex = 0;

    const step = (): void => {
      if (stepIndex >= steps.length) {
        set({ round: { ...get().round!, dealerHand: final.round.dealerHand }, pendingReveals: 0 });
        resolveAndSettle();
        return;
      }
      const event = steps[stepIndex];
      stepIndex += 1;

      if (event.type === 'cardBecameVisible') {
        const current = get().round!;
        const dealerHand =
          event.source === 'holeReveal'
            ? {
                ...current.dealerHand,
                cards: [event.card, ...current.dealerHand.cards.slice(1)],
                holeRevealed: true,
              }
            : {
                ...current.dealerHand,
                cards: [...current.dealerHand.cards, event.card],
              };
        set({
          round: { ...current, dealerHand },
          pendingReveals:
            event.source === 'dealerDraw'
              ? Math.max(0, get().pendingReveals - 1)
              : get().pendingReveals,
        });
        applyCountEvents([event]);
      }
      schedule(step, scaledDelay(BASE_DELAYS.dealerStep));
    };

    schedule(step, scaledDelay(BASE_DELAYS.dealerStep));
  }

  /** Natural blackjack short-circuit: reveal the hole card, then resolve. */
  function shortCircuitNatural(): void {
    const { round } = get();
    if (!round) {
      return;
    }
    const holeCard = { ...round.dealerHand.cards[0], visibility: 'faceUp' as const };
    const dealerHand = {
      ...round.dealerHand,
      cards: [holeCard, ...round.dealerHand.cards.slice(1)],
      holeRevealed: true,
    };
    set({ round: { ...round, dealerHand } });
    applyCountEvents([{ type: 'cardBecameVisible', card: holeCard, source: 'holeReveal' }]);
    resolveAndSettle();
  }

  return {
    sessionActive: false,
    map: null,
    mode: 'training',
    phase: 'betting',
    shoe: null,
    round: null,
    wager: 0,
    runningCount: 0,
    shufflePending: false,
    pendingReveals: 0,
    justShuffled: false,
    resolution: null,
    payout: null,
    xpAwarded: 0,
    levelUpNotice: null,
    lastActionAt: 0,
    autoplay: false,
    isAutoplayRound: false,
    autoplaySpeed: 1,
    initialDealStep: 0,

    startSession: (mapId, mode) => {
      const map = mapById(mapId);
      if (!map) {
        return false;
      }
      clearAllTimers();
      set({
        sessionActive: true,
        map,
        mode,
        phase: 'betting',
        shoe: newShoe(mode),
        round: null,
        wager: 0,
        runningCount: 0,
        shufflePending: false,
        pendingReveals: 0,
        justShuffled: false,
        resolution: null,
        payout: null,
        xpAwarded: 0,
        levelUpNotice: null,
        lastActionAt: 0,
        autoplay: false,
        isAutoplayRound: false,
        autoplaySpeed: 1,
        initialDealStep: 0,
      });
      return true;
    },

    startAutoplay: () => {
      const { sessionActive, phase, mode, wager } = get();
      // Autoplay is a Training Mode drill and starts only from a clean betting
      // phase. Any staged wager is returned first — nothing is at stake.
      if (!sessionActive || mode !== 'training' || phase !== 'betting') {
        return false;
      }
      if (wager > 0) {
        useEconomyStore.getState().creditChips(wager);
        set({ wager: 0 });
      }
      set({ autoplay: true, autoplaySpeed: useSettingsStore.getState().dealerSpeed });
      schedule(autoDeal, scaledDelay(BASE_DELAYS.collect));
      return true;
    },

    setAutoplaySpeed: (speed) => {
      if (!get().autoplay && !get().isAutoplayRound) {
        return;
      }
      set({ autoplaySpeed: clampDealerSpeed(speed) });
    },

    stopAutoplay: () => {
      set({ autoplay: false });
      // A drill waiting in the betting phase has nothing to finish.
      if (get().phase === 'betting') {
        set({ isAutoplayRound: false });
      }
    },

    endSession: () => {
      clearAllTimers();
      const { phase, round, wager, isAutoplayRound } = get();
      // Refund any chips still in play: a bet not yet dealt, or a round that
      // was interrupted before its payout phase credited the bankroll.
      // Autoplay rounds never staked chips, so they refund nothing.
      let refund = 0;
      if (isAutoplayRound) {
        refund = 0;
      } else if (phase === 'betting' || phase === 'dealing') {
        refund = round
          ? round.playerHands.reduce((sum, hand) => sum + hand.bet, 0)
          : wager;
      } else if (phase === 'playerTurn' || phase === 'dealerTurn' || phase === 'resolution') {
        refund = round ? round.playerHands.reduce((sum, hand) => sum + hand.bet, 0) : 0;
      }
      if (refund > 0) {
        useEconomyStore.getState().creditChips(refund);
      }
      set({
        sessionActive: false,
        map: null,
        phase: 'betting',
        shoe: null,
        round: null,
        wager: 0,
        runningCount: 0,
        shufflePending: false,
        pendingReveals: 0,
        justShuffled: false,
        resolution: null,
        payout: null,
        xpAwarded: 0,
        levelUpNotice: null,
        autoplay: false,
        isAutoplayRound: false,
        autoplaySpeed: 1,
        initialDealStep: 0,
      });
    },

    addChipToBet: (chipValue) => {
      const { phase, wager, map, autoplay } = get();
      if (phase !== 'betting' || !map || autoplay) {
        return false;
      }
      if (!Number.isInteger(chipValue) || chipValue <= 0) {
        return false;
      }
      if (wager + chipValue > map.maxBet) {
        return false;
      }
      if (!useEconomyStore.getState().debitChips(chipValue)) {
        return false;
      }
      set({ wager: wager + chipValue });
      return true;
    },

    returnBet: () => {
      const { phase, wager } = get();
      if (phase !== 'betting' || wager === 0) {
        return;
      }
      useEconomyStore.getState().creditChips(wager);
      set({ wager: 0 });
    },

    redoBet: () => {
      const { phase, wager, map } = get();
      const lastBet = useEconomyStore.getState().lastBet;
      if (phase !== 'betting' || !map || lastBet <= 0 || lastBet > map.maxBet) {
        return;
      }
      // Refund the current wager first, then place the previous bet whole.
      const economy = useEconomyStore.getState();
      if (economy.chips + wager < lastBet) {
        return;
      }
      if (wager > 0) {
        economy.creditChips(wager);
      }
      if (!useEconomyStore.getState().debitChips(lastBet)) {
        return;
      }
      set({ wager: lastBet });
    },

    deal: () => {
      const { phase, wager, shoe, map, autoplay } = get();
      if (phase !== 'betting' || !shoe || !map || autoplay || !isValidBet(wager, map.maxBet)) {
        return false;
      }

      useEconomyStore.getState().setLastBet(wager);
      recordMapEvent({ type: 'BET_PLACED', amount: wager });
      if (useEconomyStore.getState().chips === 0) {
        recordMapEvent({ type: 'ALL_IN_BET', amount: wager });
      }

      let step;
      try {
        step = startRound(wager, shoe);
      } catch (error) {
        if (error instanceof EmptyShoeError) {
          // Extremely defensive: force a shuffle and stay in betting.
          set({ shoe: newShoe(get().mode), runningCount: 0, shufflePending: false });
          return false;
        }
        throw error;
      }

      set({
        phase: transition('betting', 'dealing'),
        round: step.round,
        shoe: step.shoe,
        wager: 0,
        resolution: null,
        payout: null,
        xpAwarded: 0,
        shufflePending: isShufflePending(step.shoe),
        lastActionAt: Date.now(),
        isAutoplayRound: false,
        initialDealStep: 0,
      });

      const shortCircuit = step.events.some((e) => e.type === 'playerTurnComplete');
      runInitialDealSequence(step, shortCircuit, () => {
        if (shortCircuit) {
          shortCircuitNatural();
        } else {
          toPhase('playerTurn');
        }
      });
      return true;
    },

    canAct: (action) => {
      const { phase, round, isAutoplayRound } = get();
      if (phase !== 'playerTurn' || !round || round.activeHandIndex === null || isAutoplayRound) {
        return false;
      }
      const hand = round.playerHands[round.activeHandIndex];
      const chips = useEconomyStore.getState().chips;
      switch (action) {
        case 'hit':
        case 'stand':
          return hand.status === 'active';
        case 'double':
          return canDouble(hand) && chips >= hand.bet;
        case 'split':
          return canSplit(hand, round.splitUsed) && chips >= hand.bet;
      }
    },

    act: (action) => {
      const now = Date.now();
      const { round, shoe, lastActionAt } = get();
      if (now - lastActionAt < ACTION_COOLDOWN_MS) {
        return false; // rapid-tap guard
      }
      if (!get().canAct(action) || !round || !shoe) {
        return false;
      }

      // Double/split stake extra chips before cards move.
      if (action === 'double' || action === 'split') {
        const hand = round.playerHands[round.activeHandIndex!];
        if (!useEconomyStore.getState().debitChips(hand.bet)) {
          return false;
        }
      }

      let step;
      try {
        step = applyPlayerAction(round, shoe, action);
      } catch (error) {
        if (error instanceof IllegalActionError || error instanceof EmptyShoeError) {
          // Refund the extra stake if the engine refused the action.
          if (action === 'double' || action === 'split') {
            useEconomyStore.getState().creditChips(round.playerHands[round.activeHandIndex!].bet);
          }
          return false;
        }
        throw error;
      }

      set({ round: step.round, shoe: step.shoe, lastActionAt: now });
      applyCountEvents(step.events);

      if (action === 'double') {
        recordMapEvent({ type: 'DOUBLE_USED' });
      }
      if (action === 'split') {
        recordMapEvent({ type: 'SPLIT_USED' });
      }

      if (step.events.some((e) => e.type === 'playerTurnComplete')) {
        schedule(runDealerSequence, scaledDelay(BASE_DELAYS.dealerStep));
      }
      return true;
    },

    getTrueCount: () => {
      const { shoe, runningCount } = get();
      return shoe ? trueCount(runningCount, get().getCardsRemainingVisible()) : 0;
    },

    getCardsRemainingVisible: () => {
      const { shoe, pendingReveals } = get();
      return shoe ? cardsRemaining(shoe) + pendingReveals : 0;
    },

    dismissLevelUp: () => set({ levelUpNotice: null }),

    applyDeckCountChange: (mode) => {
      const { sessionActive, mode: sessionMode, phase, shoe } = get();
      if (!sessionActive || mode !== sessionMode) {
        return;
      }
      const settingsDecks = useSettingsStore.getState().deckCounts[mode];
      if (!shoe || shoe.deckCount === settingsDecks) {
        return;
      }
      // Mid-round: collectRound already rebuilds when deckCount mismatches.
      // Between hands, reshuffle and reset the count immediately.
      if (phase !== 'betting' || get().round) {
        return;
      }
      set({
        shoe: newShoe(mode),
        runningCount: 0,
        shufflePending: false,
        justShuffled: true,
        pendingReveals: 0,
      });
      schedule(() => set({ justShuffled: false }), scaledDelay(BASE_DELAYS.shuffleNotice));
    },
  };
});
