import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { SecondaryButton } from '../../components/common/SecondaryButton';
import { ActionBar } from '../../components/game/ActionBar';
import { BetSpot } from '../../components/game/BetSpot';
import { BettingPanel } from '../../components/game/BettingPanel';
import { CountCheckPrompt } from '../../components/game/CountCheckPrompt';
import { CountPulse } from '../../components/game/CountPulse';
import { CoachToggle } from '../../components/game/CoachToggle';
import { CountRail } from '../../components/game/CountRail';
import { DealerArea } from '../../components/game/DealerArea';
import { DeviationToast } from '../../components/game/DeviationToast';
import { DistributionChartModal } from '../../components/game/DistributionChartModal';
import { FeltBackdrop } from '../../components/game/FeltBackdrop';
import { GameSettingsSheet } from '../../components/game/GameSettingsSheet';
import { GameTableHud } from '../../components/game/GameTableHud';
import { GameToasts } from '../../components/game/GameToasts';
import { HandChips } from '../../components/game/HandChips';
import { HandView } from '../../components/game/HandView';
import { LearnCountBar } from '../../components/game/LearnCountBar';
import { MapCoverflow, QuizOrGameMode } from '../../components/game/MapCoverflow';
import { PayoutBanner } from '../../components/game/PayoutBanner';
import { RegularInfoBar } from '../../components/game/RegularInfoBar';
import { ShuffleCeremony } from '../../components/game/ShuffleCeremony';
import { StrategyChartModal } from '../../components/game/StrategyChartModal';
import { TableCamera } from '../../components/game/TableCamera';
import { TablePilesRow } from '../../components/game/TablePilesRow';
import { TrainingToggle } from '../../components/game/TrainingToggle';
import { ObjectivePanel } from '../../components/dojo/ObjectivePanel';
import { objectivesForMap } from '../../engine/dojo';
import { SpeedSlider } from '../../components/settings/SettingsRows';
import { HandResult } from '../../engine/blackjack/resolve';
import { effectiveDealerSpeed, mapById } from '../../engine/betting/casino';
import { playSound, warmTableSounds } from '../../services/audio';
import { initialDealVisibleCounts } from '../../utils/dealSequence';
import { useDojoStore } from '../../stores/dojoStore';
import { FLASH_DEBUG_AVAILABLE, useFlashDebugStore } from '../../stores/flashDebugStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useProgressionStore } from '../../stores/progressionStore';
import {
  DEALER_SPEED_MAX,
  DEALER_SPEED_MIN,
  DEALER_SPEED_STEP,
  useSettingsStore,
} from '../../stores/settingsStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import {
  COUNT_COACH_LABELS,
  countCoachCapabilities,
  effectiveCountCoachLevel,
  effectiveTrainingAids,
} from '../../utils/countCoach';
import { FEATURES } from '../../constants/features';

const RESULT_BADGE: Record<HandResult, { text: string; color: string }> = {
  blackjack: { text: 'BLACKJACK', color: colors.goldBright },
  win: { text: 'WIN', color: colors.success },
  push: { text: 'PUSH', color: colors.trainingNeutral },
  loss: { text: 'LOSS', color: colors.error },
};

/** Felt showing between the cards of a hand (each card adds its own 2pt ring). */
const CARD_GAP = spacing.xs;

/**
 * Blackjack table for every casino. One experience, one dial: the Count
 * Coach tab on the right rail cycles Off / Learn / Full. Full turns the live
 * counts, count rail, card underglow, strategy hints and card charts on;
 * Learn is casino-real play with the fogged "?" meter — tap it (or pass
 * post-round checks) to reveal the numbers; Off is the bare casino. (The old
 * on/off Training switch sits behind FEATURES.countCoachDial = false.)
 */
export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mapId } = useLocalSearchParams<{ mapId: string }>();
  const parsed = Number(mapId);
  const map = Number.isInteger(parsed) ? mapById(parsed) : undefined;

  const startSession = useGameSessionStore((state) => state.startSession);
  const endSession = useGameSessionStore((state) => state.endSession);
  const sessionActive = useGameSessionStore((state) => state.sessionActive);
  const phase = useGameSessionStore((state) => state.phase);
  const round = useGameSessionStore((state) => state.round);
  const resolution = useGameSessionStore((state) => state.resolution);
  const payout = useGameSessionStore((state) => state.payout);
  const initialDealStep = useGameSessionStore((state) => state.initialDealStep);
  const shoe = useGameSessionStore((state) => state.shoe);
  const pendingReveals = useGameSessionStore((state) => state.pendingReveals);
  const wager = useGameSessionStore((state) => state.wager);
  const dealVisible =
    phase === 'dealing' ? initialDealVisibleCounts(initialDealStep) : null;
  const trainingAids = useSettingsStore((state) => state.trainingAids);
  const {
    cardUnderglow: underglowEnabled,
    distributionCharts: chartsEnabled,
    strategyHints: strategyHintsEnabled,
    countPulse: pulseEnabled,
  } = effectiveTrainingAids(trainingAids);
  const dealerSpeedSetting = useSettingsStore((state) => state.dealerSpeed);
  /** The casino's own pace with the player's setting stacked on top. */
  const dealerSpeed = effectiveDealerSpeed(map, dealerSpeedSetting);
  const countCoachLevel = useSettingsStore((state) => state.countCoachLevel);
  const setCountCoachLevel = useSettingsStore((state) => state.setCountCoachLevel);
  const trainingMode = useSettingsStore((state) => state.trainingMode);
  const setTrainingMode = useSettingsStore((state) => state.setTrainingMode);
  const deviationNotice = useGameSessionStore((state) => state.deviationNotice);
  const coach = countCoachCapabilities(effectiveCountCoachLevel(countCoachLevel, trainingMode));
  const license = useProgressionStore((state) =>
    map ? state.licenseForMap(map.id) : 'none',
  );
  const nextFlashLevel = useDojoStore((state) => (map ? state.nextFlashLevel(map.id) : 1));
  const debugUnlockAll = useFlashDebugStore((state) => FLASH_DEBUG_AVAILABLE && state.unlockAll);

  const autoplay = useGameSessionStore((state) => state.autoplay);
  const isAutoplayRound = useGameSessionStore((state) => state.isAutoplayRound);
  const autoplaySpeed = useGameSessionStore((state) => state.autoplaySpeed);
  const startAutoplay = useGameSessionStore((state) => state.startAutoplay);
  const stopAutoplay = useGameSessionStore((state) => state.stopAutoplay);
  const setAutoplaySpeed = useGameSessionStore((state) => state.setAutoplaySpeed);
  const guidedMode = useGameSessionStore((state) => state.guidedMode);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);

  const justShuffled = useGameSessionStore((state) => state.justShuffled);
  useEffect(() => {
    if (justShuffled) {
      playSound('shuffle');
    }
  }, [justShuffled]);

  useEffect(() => {
    if (map) {
      warmTableSounds();
      startSession(map.id);
    }
    return () => {
      endSession();
    };
  }, [map, startSession, endSession]);

  if (!map) {
    // Bad or stale link — land the player at the default table instead of a dead end.
    return <Redirect href={{ pathname: '/game/[mapId]', params: { mapId: '1' } }} />;
  }
  if (!sessionActive) {
    return <View style={styles.root} />;
  }

  function handleMapSelect(mapId: number, selectedMode: QuizOrGameMode) {
    setMapsOpen(false);
    if (selectedMode === 'quiz') {
      router.push({ pathname: '/quiz/[mapId]', params: { mapId: String(mapId) } });
      return;
    }
    if (mapId === map!.id) {
      return; // already at this table
    }
    router.replace({ pathname: '/game/[mapId]', params: { mapId: String(mapId) } });
  }

  // The coach level gates every aid; the per-aid switches (when enabled) refine it.
  const underglow = coach.showCardValueGlow && underglowEnabled;
  // The Hi-Lo-printed card faces stay shelved (FEATURES.trainingCardSkin).
  const cardSkin = FEATURES.trainingCardSkin && coach.useTrainingSkin ? 'training' : 'regular';
  const isSplit = (round?.playerHands.length ?? 0) > 1;
  /** Match dealer card size; only shrink further when a split needs two hands. */
  const dealerCardWidth = Math.min((width - 80) / 5.2, 76);
  const playerCardWidth = isSplit
    ? Math.min((width - 120) / 6, dealerCardWidth)
    : dealerCardWidth;
  // Cards sit a little apart; a long hand tucks in only once it would run
  // out of felt. The dealer has the row inside the screen padding; split
  // hands share it, each inside its own slot padding.
  const dealerRowWidth = width - layout.screenPaddingH * 2;
  const playerRowWidth = isSplit
    ? (dealerRowWidth - spacing.sm) / 2 - spacing.sm * 2
    : dealerRowWidth;
  const modeLabel = FEATURES.countCoachDial
    ? `Count Coach · ${COUNT_COACH_LABELS[countCoachLevel]}`
    : 'Hi-Lo Trainer';

  const statusText =
    phase === 'dealing'
      ? 'Dealing…'
      : phase === 'dealerTurn'
        ? 'Dealer plays…'
        : phase === 'shuffling'
          ? 'Shuffling…'
          : phase === 'collecting'
            ? 'Clearing the table…'
            : null;

  /** Deal sits you at the rail; betting pulls the camera back behind the chair. */
  const cameraSeated = phase !== 'betting' || isAutoplayRound;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Felt and house lettering: fixed to the screen, outside the table
          camera, so the print never moves — the pieces sit down onto it. */}
      <FeltBackdrop feltKey={map.feltKey} casinoName={map.name} seated={cameraSeated} />

      <GameTableHud
        mapName={map.name}
        modeLabel={guidedMode ? 'Guided Dojo Table' : modeLabel}
        // The control opens the casino fan (globe) or the level map (map), so
        // it wears the same glyph the training screens use for the map.
        leftIcon={FEATURES.casinoFan ? 'globe-outline' : 'map-outline'}
        leftAccessibilityLabel={FEATURES.casinoFan ? 'Switch casino or mode' : 'Level map'}
        onOpenMaps={() =>
          FEATURES.casinoFan
            ? setMapsOpen(true)
            : router.push({ pathname: '/levels/[mapId]', params: { mapId: String(map.id) } })
        }
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />

      {guidedMode ? (
        <View style={styles.objectivePanel}>
          <ObjectivePanel
            objectives={objectivesForMap(map)}
            completed={new Set()}
            progress={{}}
          />
        </View>
      ) : null}

      <TableCamera seated={cameraSeated}>
        {coach.showLiveCounts || coach.showMaskedCounts ? (
          <>
            {/* The rail is a training aid: it leaves with Training Mode. The
                strip stays put and only fogs its numbers, so the toggle never
                shifts the layout. */}
            {coach.showLiveCounts ? <CountRail /> : null}
            <View style={styles.countSection}>
              <TablePilesRow
                center={<LearnCountBar live={coach.showLiveCounts} />}
                round={round}
                shoe={shoe}
                phase={phase}
                initialDealStep={initialDealStep}
                pendingReveals={pendingReveals}
                insetForCountRail
                showCutCardMarker={coach.showShoeProgress}
              />
              <ShuffleCeremony active={phase === 'shuffling'} />
            </View>
          </>
        ) : (
          <View style={styles.regularInfoSection}>
            <TablePilesRow
              center={<RegularInfoBar />}
              round={round}
              shoe={shoe}
              phase={phase}
              initialDealStep={initialDealStep}
              pendingReveals={pendingReveals}
              showCutCardMarker={coach.showShoeProgress}
            />
            <ShuffleCeremony active={phase === 'shuffling'} />
          </View>
        )}

        <View style={styles.dealerArea}>
          <DealerArea
            round={round}
            dealerCardWidth={dealerCardWidth}
            skin={cardSkin}
            underglow={underglow}
            speed={dealerSpeed}
            maxVisibleCards={dealVisible?.dealer}
            areaLabel={`DEALER${dealerSpeed !== 1 ? ` · ${dealerSpeed.toFixed(2)}×` : ''}`}
            cardGap={CARD_GAP}
            maxWidth={dealerRowWidth}
          />
        </View>

        {/* The open felt between dealer and player, where the house lettering
            shows through from the backdrop. The Count Coach tab sits on the
            right rail of this gap; the off-book toast floats in its middle. */}
        <View style={styles.centerFelt}>
          {coach.level !== 'off' ? <DeviationToast notice={deviationNotice} /> : null}
          <View style={styles.trainingToggle}>
            {FEATURES.countCoachDial ? (
              <CoachToggle level={countCoachLevel} onSelect={setCountCoachLevel} />
            ) : (
              <TrainingToggle enabled={trainingMode} onToggle={setTrainingMode} />
            )}
          </View>
        </View>

        {/* Player hands sit in the lower felt; bet circle only while betting so
            in-round cards keep their previous placement and don't cover the dealer. */}
        <View style={styles.playerArea}>
          {round ? (
            <View style={[styles.hands, isSplit && styles.handsSplit]}>
              {round.playerHands.map((hand, index) => {
                const result = resolution?.hands[index]?.result;
                return (
                  <View key={hand.id} style={styles.handSlot}>
                    {result ? (
                      <Text style={[styles.resultBadge, { color: RESULT_BADGE[result].color }]}>
                        {RESULT_BADGE[result].text}
                      </Text>
                    ) : null}
                    <HandView
                      hand={hand}
                      skin={cardSkin}
                      cardWidth={playerCardWidth}
                      underglow={underglow}
                      speed={dealerSpeed}
                      maxVisibleCards={index === 0 ? dealVisible?.player : undefined}
                      cardGap={CARD_GAP}
                      maxWidth={playerRowWidth}
                    />
                    {isAutoplayRound ? (
                      <Text style={styles.handBet}>Drill{hand.isDoubled ? ' · doubled' : ''}</Text>
                    ) : (
                      <HandChips
                        bet={hand.bet}
                        chipSetKey={map.chipSetKey}
                        phase={phase}
                        result={result ?? null}
                        profit={payout?.hands[index]?.profit ?? 0}
                        doubled={hand.isDoubled}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ) : phase === 'betting' && !isAutoplayRound ? (
            <BetSpot
              chipSetKey={map.chipSetKey}
              maxBet={map.maxBet}
              wager={wager}
              showEmpty={wager <= 0}
            />
          ) : null}
        </View>
      </TableCamera>

      {/* Bottom panel — betting keeps a taller slot for the tray; in-round
          uses a compact slot so the hand sits closer to Hit/Stand. */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + spacing.md }]}>
        {autoplay || isAutoplayRound ? (
          <View style={styles.autoplayRow}>
            <Text style={styles.autoplayText}>
              {autoplay ? 'Autoplay drill running — practice counting' : 'Finishing last drill hand…'}
            </Text>
            {autoplay ? (
              <>
                <SpeedSlider
                  label="Drill speed"
                  value={autoplaySpeed}
                  min={DEALER_SPEED_MIN}
                  max={DEALER_SPEED_MAX}
                  step={DEALER_SPEED_STEP}
                  onChange={setAutoplaySpeed}
                />
                <SecondaryButton label="Stop autoplay" onPress={stopAutoplay} />
              </>
            ) : null}
          </View>
        ) : (
          <View
            style={
              phase === 'betting' ? styles.controlsSlotBetting : styles.controlsSlotPlay
            }
          >
            {phase === 'betting' ? (
              <View style={styles.actionSection}>
                <BettingPanel />
                {FEATURES.autoplayDrill && coach.allowFullTools ? (
                  <Text style={styles.aidLink} onPress={startAutoplay}>
                    Start autoplay drill (no chips at stake)
                  </Text>
                ) : null}
              </View>
            ) : phase === 'playerTurn' ? (
              <View style={styles.actionSection}>
                <ActionBar />
                <View style={styles.aidButtons}>
                  {coach.allowFullTools && strategyHintsEnabled ? (
                    <Text style={styles.aidLink} onPress={() => setStrategyOpen(true)}>
                      Strategy chart
                    </Text>
                  ) : null}
                  {coach.allowFullTools && chartsEnabled ? (
                    <Text style={styles.aidLink} onPress={() => setChartsOpen(true)}>
                      Card charts
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : statusText ? (
              <Text style={styles.statusText}>{statusText}</Text>
            ) : null}
          </View>
        )}
      </View>

      <PayoutBanner />
      {coach.allowFullTools && pulseEnabled ? <CountPulse /> : null}
      {coach.showCountCheck ? <CountCheckPrompt /> : null}

      {license === 'none' && !debugUnlockAll ? (
        <View style={styles.licenseGate}>
          <View style={styles.licenseCard}>
            <Text style={styles.licenseKicker}>TABLE CLOSED</Text>
            <Text style={styles.licenseTitle}>Earn your seat at {map.name}</Text>
            <Text style={styles.licenseBody}>
              This floor opens to counters. Clear the six training levels at this casino and the
              table is yours.
            </Text>
            <PrimaryButton
              label={`Play level ${nextFlashLevel ?? 1}`}
              onPress={() =>
                router.replace({
                  pathname: '/flash/[mapId]/[level]',
                  params: { mapId: String(map.id), level: String(nextFlashLevel ?? 1) },
                })
              }
            />
            <SecondaryButton
              label="Level map"
              onPress={() =>
                router.push({ pathname: '/levels/[mapId]', params: { mapId: String(map.id) } })
              }
            />
          </View>
        </View>
      ) : null}

      <GameToasts />
      <GameSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mapId={map.id}
      />
      <StrategyChartModal visible={strategyOpen} onClose={() => setStrategyOpen(false)} />
      <DistributionChartModal visible={chartsOpen} onClose={() => setChartsOpen(false)} />
      {FEATURES.casinoFan ? (
        <MapCoverflow
          visible={mapsOpen}
          currentMapId={map.id}
          onClose={() => setMapsOpen(false)}
          onSelect={handleMapSelect}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  licenseGate: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    zIndex: 50,
  },
  licenseCard: {
    width: '88%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    padding: spacing.xl,
  },
  licenseKicker: {
    color: colors.gold,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
  },
  licenseTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  licenseBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  objectivePanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    zIndex: 10,
  },
  regularInfoSection: {
    paddingBottom: spacing.xs,
    position: 'relative',
  },
  countSection: {
    paddingBottom: spacing.xs,
    position: 'relative',
  },
  dealerArea: {
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    minHeight: 130,
    flexShrink: 0,
  },
  /** Takes whatever the dealer and hand leave. */
  centerFelt: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    justifyContent: 'center',
  },
  trainingToggle: {
    position: 'absolute',
    right: layout.screenPaddingH,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  playerArea: {
    flexShrink: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: 0,
    gap: spacing.xs,
  },
  hands: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  handsSplit: {
    flexDirection: 'row-reverse', // right hand (index 0) renders on the right
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    width: '100%',
  },
  // No frame or tint on the hand — the cards sit straight on the felt.
  handSlot: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  resultBadge: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.5,
  },
  handBet: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontVariant: ['tabular-nums'],
  },
  bottomPanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  /** Chip tray + Deal row while betting. */
  controlsSlotBetting: {
    minHeight: 170,
    justifyContent: 'flex-end',
  },
  /** ActionBar + aid links — tight so the hand sits just above the buttons. */
  controlsSlotPlay: {
    minHeight: 96,
    justifyContent: 'flex-start',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionSection: {
    gap: spacing.sm,
  },
  aidButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  aidLink: {
    color: colors.gold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  autoplayRow: {
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  autoplayText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
