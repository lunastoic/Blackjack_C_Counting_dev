import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABLE_FELTS } from '../../assets/registry';
import { SecondaryButton } from '../../components/common/SecondaryButton';
import { ActionBar } from '../../components/game/ActionBar';
import { BetSpot } from '../../components/game/BetSpot';
import { BettingPanel } from '../../components/game/BettingPanel';
import { CountPulse } from '../../components/game/CountPulse';
import { CountRail } from '../../components/game/CountRail';
import { CountStatsBar } from '../../components/game/CountBar';
import { DealerArea } from '../../components/game/DealerArea';
import { DistributionChartModal } from '../../components/game/DistributionChartModal';
import { GameSettingsSheet } from '../../components/game/GameSettingsSheet';
import { GameTableHud } from '../../components/game/GameTableHud';
import { GameToasts } from '../../components/game/GameToasts';
import { HandChips } from '../../components/game/HandChips';
import { HandView } from '../../components/game/HandView';
import { MapCoverflow, QuizOrGameMode } from '../../components/game/MapCoverflow';
import { PayoutBanner } from '../../components/game/PayoutBanner';
import { RegularInfoBar } from '../../components/game/RegularInfoBar';
import { ShuffleCeremony } from '../../components/game/ShuffleCeremony';
import { StrategyChartModal } from '../../components/game/StrategyChartModal';
import { TableCamera } from '../../components/game/TableCamera';
import { TablePilesRow } from '../../components/game/TablePilesRow';
import { SpeedSlider } from '../../components/settings/SettingsRows';
import { HandResult } from '../../engine/blackjack/resolve';
import { GameMode } from '../../engine/blackjack/rules';
import { mapById } from '../../engine/betting/casino';
import { playSound } from '../../services/audio';
import { initialDealVisibleCounts } from '../../utils/dealSequence';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import {
  DEALER_SPEED_MAX,
  DEALER_SPEED_MIN,
  DEALER_SPEED_STEP,
  useSettingsStore,
} from '../../stores/settingsStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';

const RESULT_BADGE: Record<HandResult, { text: string; color: string }> = {
  blackjack: { text: 'BLACKJACK', color: colors.goldBright },
  win: { text: 'WIN', color: colors.success },
  push: { text: 'PUSH', color: colors.trainingNeutral },
  loss: { text: 'LOSS', color: colors.error },
};

/**
 * Blackjack table for every casino: Training Mode (aids on, training card
 * skin) or Regular Mode (aids and counts hidden) chosen by the `mode` param.
 */
export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mapId, mode: modeParam } = useLocalSearchParams<{ mapId: string; mode?: string }>();
  const parsed = Number(mapId);
  const map = Number.isInteger(parsed) ? mapById(parsed) : undefined;
  const requestedMode: GameMode = modeParam === 'regular' ? 'regular' : 'training';

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
  const mode = useGameSessionStore((state) => state.mode);
  const underglowEnabled = useSettingsStore((state) => state.trainingAids.cardUnderglow);
  const chartsEnabled = useSettingsStore((state) => state.trainingAids.distributionCharts);
  const dealerSpeed = useSettingsStore((state) => state.dealerSpeed);

  const autoplay = useGameSessionStore((state) => state.autoplay);
  const isAutoplayRound = useGameSessionStore((state) => state.isAutoplayRound);
  const autoplaySpeed = useGameSessionStore((state) => state.autoplaySpeed);
  const startAutoplay = useGameSessionStore((state) => state.startAutoplay);
  const stopAutoplay = useGameSessionStore((state) => state.stopAutoplay);
  const setAutoplaySpeed = useGameSessionStore((state) => state.setAutoplaySpeed);

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
      startSession(map.id, requestedMode);
    }
    return () => {
      endSession();
    };
  }, [map, requestedMode, startSession, endSession]);

  if (!map) {
    // Bad or stale link — land the player at the default table instead of a dead end.
    return (
      <Redirect
        href={{ pathname: '/game/[mapId]', params: { mapId: '1', mode: 'training' } }}
      />
    );
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
    if (mapId === map!.id && selectedMode === mode) {
      return; // already at this table in this mode
    }
    router.replace({
      pathname: '/game/[mapId]',
      params: { mapId: String(mapId), mode: selectedMode },
    });
  }

  const underglow = mode === 'training' && underglowEnabled;
  const isSplit = (round?.playerHands.length ?? 0) > 1;
  /** Match dealer card size; only shrink further when a split needs two hands. */
  const dealerCardWidth = Math.min((width - 80) / 5.2, 76);
  const playerCardWidth = isSplit
    ? Math.min((width - 120) / 6, dealerCardWidth)
    : dealerCardWidth;

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
      <Image
        source={TABLE_FELTS[map.feltKey] ?? TABLE_FELTS['gray-suede']}
        style={styles.felt}
        resizeMode="cover"
      />
      <View style={styles.feltTint} pointerEvents="none" />

      <GameTableHud
        mapName={map.name}
        modeLabel={mode === 'training' ? 'Training' : 'Regular'}
        onOpenMaps={() => setMapsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />

      <TableCamera seated={cameraSeated}>
        {mode === 'training' ? (
          <>
            <CountRail />
            <View style={styles.countSection}>
              <TablePilesRow
                center={<CountStatsBar />}
                round={round}
                shoe={shoe}
                phase={phase}
                initialDealStep={initialDealStep}
                pendingReveals={pendingReveals}
                insetForCountRail
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
            />
            <ShuffleCeremony active={phase === 'shuffling'} />
          </View>
        )}

        <View style={styles.dealerArea}>
          <DealerArea
            round={round}
            dealerCardWidth={dealerCardWidth}
            skin={mode === 'training' ? 'training' : 'regular'}
            underglow={underglow}
            speed={dealerSpeed}
            maxVisibleCards={dealVisible?.dealer}
            areaLabel={`DEALER${dealerSpeed !== 1 ? ` · ${dealerSpeed.toFixed(2)}×` : ''}`}
          />
        </View>

        {/* Player hands sit in the lower felt; bet circle only while betting so
            in-round cards keep their previous placement and don't cover the dealer. */}
        <View style={styles.playerArea}>
          {round ? (
            <View style={[styles.hands, isSplit && styles.handsSplit]}>
              {round.playerHands.map((hand, index) => {
                const isActive = phase === 'playerTurn' && round.activeHandIndex === index;
                const result = resolution?.hands[index]?.result;
                return (
                  <View
                    key={hand.id}
                    style={[styles.handSlot, isActive && styles.handSlotActive]}
                  >
                    {result ? (
                      <Text style={[styles.resultBadge, { color: RESULT_BADGE[result].color }]}>
                        {RESULT_BADGE[result].text}
                      </Text>
                    ) : null}
                    <HandView
                      hand={hand}
                      skin={mode === 'training' ? 'training' : 'regular'}
                      cardWidth={playerCardWidth}
                      underglow={underglow}
                      speed={dealerSpeed}
                      maxVisibleCards={index === 0 ? dealVisible?.player : undefined}
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
                {mode === 'training' ? (
                  <Text style={styles.aidLink} onPress={startAutoplay}>
                    Start autoplay drill (no chips at stake)
                  </Text>
                ) : null}
              </View>
            ) : phase === 'playerTurn' ? (
              <View style={styles.actionSection}>
                <ActionBar />
                <View style={styles.aidButtons}>
                  {mode === 'training' ? (
                    <Text style={styles.aidLink} onPress={() => setStrategyOpen(true)}>
                      Strategy chart
                    </Text>
                  ) : null}
                  {mode === 'training' && chartsEnabled ? (
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
      {mode === 'training' ? <CountPulse /> : null}
      <GameToasts />
      <GameSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <StrategyChartModal visible={strategyOpen} onClose={() => setStrategyOpen(false)} />
      <DistributionChartModal visible={chartsOpen} onClose={() => setChartsOpen(false)} />
      <MapCoverflow
        visible={mapsOpen}
        currentMapId={map.id}
        onClose={() => setMapsOpen(false)}
        onSelect={handleMapSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  felt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  feltTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayLight,
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
  playerArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: spacing.lg,
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
  handSlot: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.sm,
  },
  handSlotActive: {
    borderColor: colors.gold,
    backgroundColor: colors.overlayLight,
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
