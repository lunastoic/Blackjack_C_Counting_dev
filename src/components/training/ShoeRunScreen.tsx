import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODERN_TABLE_FELTS, TABLE_FELTS } from '../../assets/registry';
import { BET_SPREAD_MAX } from '../../engine/betting/betRamp';
import { mapById } from '../../engine/betting/casino';
import { activeHand } from '../../engine/blackjack/round';
import { PlayerAction } from '../../engine/blackjack/rules';
import { CARDS_PER_DECK } from '../../engine/cards/deck';
import { DOJO_XP, HEAT_LIMIT, STAR_COUNT, trainingLevelsForMap } from '../../engine/dojo';
import { cardsDealt, cardsRemaining } from '../../engine/shoe/shoe';
import { indexPlayFor } from '../../engine/strategy/indexPlays';
import { recommendForHand } from '../../engine/strategy/recommend';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useDojoStore } from '../../stores/dojoStore';
import { useShoeRunStore } from '../../stores/shoeRunStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { ArcadeButton } from '../arcade/ArcadeButton';
import { ArcadeLevelBrief } from '../arcade/ArcadeLevelBrief';
import { FlashLevelCompleteOverlay } from '../flash/FlashLevelCompleteOverlay';
import { FeltMarkings } from '../game/FeltMarkings';
import { GameSettingsSheet } from '../game/GameSettingsSheet';
import { GameTableHud } from '../game/GameTableHud';
import { TableCamera } from '../game/TableCamera';
import { AccuracyRow } from './AccuracyRows';
import { ChoiceGrid } from './AnswerPads';
import { formatAnswer, formatUnits, questionPrompt, shoeRunChips, starGlyphs } from './copy';
import { CountEntry } from './CountEntry';
import { TableStage } from './TableStage';
import { TrainingStatusStrip } from './TrainingStatusStrip';

interface ShoeRunScreenProps {
  readonly mapId: number;
  readonly level: number;
  /** Today's shared shoe instead of the casino's boss (dealt on `mapId`'s felt). */
  readonly daily?: boolean;
}

const ACTIONS: readonly { readonly action: PlayerAction; readonly label: string }[] = [
  { action: 'hit', label: 'Hit' },
  { action: 'stand', label: 'Stand' },
  { action: 'double', label: 'Double' },
  { action: 'split', label: 'Split' },
];

const KIND_LABEL = { count: 'COUNTS', bet: 'BETS', insurance: 'INSURANCE', play: 'INDEX PLAYS' } as const;

function units(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}u`;
}

/**
 * Beat the Shoe — each casino's boss level. The casino's felt with one seat
 * that is yours: count checks, bets, insurance and the plays happen in the
 * bottom panel, the verdict on every graded call rides over it, and the run
 * ends on the results card beside a flat bettor on the same cards.
 */
export function ShoeRunScreen({ mapId, level, daily = false }: ShoeRunScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const map = mapById(mapId)!;
  const nextMap = mapById(mapId + 1);
  const nextSpec = trainingLevelsForMap(mapId).find((entry) => entry.level === level + 1) ?? null;

  const state = useShoeRunStore();
  const { spec, status, round, shoe, question, verdict, heat, hands, score, stars, outcome, backedOff } = state;
  const tableOpen = useDojoStore((dojo) => dojo.isMapFlashComplete(mapId));
  const dailyRecord = useDojoStore((dojo) => dojo.dailyShoe);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [betUnits, setBetUnits] = useState(1);

  useEffect(() => {
    if (daily) {
      state.loadDaily();
    } else {
      state.load(mapId, level);
    }
    return () => {
      useShoeRunStore.getState().reset();
    };
    // Loading once per level; the store's actions are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, level, daily]);

  if (!spec) {
    return null;
  }

  const totalCards = spec.deckCount * CARDS_PER_DECK;
  const hand = round ? activeHand(round) : null;
  const dealerUp = round?.dealerHand.cards[1];
  const indexSpot =
    spec.indexPlays && hand && dealerUp && round?.playerHands.length === 1
      ? indexPlayFor(hand.cards, dealerUp.rank)
      : null;
  // The book play lights up — except on a graded index spot, where it would give the answer away.
  const hint =
    status === 'play' && hand && dealerUp && !indexSpot
      ? recommendForHand(
          hand,
          dealerUp.rank,
          { canDouble: state.canAct('double'), canSplit: state.canAct('split') },
          spec.deckCount,
        ).preferredAction
      : null;

  const accuracy = state.calls.length
    ? Math.round((state.calls.filter((call) => call.right).length / state.calls.length) * 100)
    : null;
  const cells = [
    { label: 'HAND', value: `${Math.min(hands, spec.hands)}`, dim: `/${spec.hands}` },
    { label: 'RIGHT', value: accuracy === null ? '—' : `${accuracy}%` },
    ...(spec.betting ? [{ label: 'YOU · FLAT', value: `${units(state.you)} · ${units(state.flat)}` }] : []),
  ];

  const cardWidth = Math.min(70, Math.floor((width - 120) / 1.7));
  const table = {
    seats: round
      ? [
          {
            hands: round.playerHands,
            results: state.resolution ? state.resolution.hands.map((entry) => entry.result) : round.playerHands.map(() => null),
          },
        ]
      : [],
    dealer: round?.dealerHand ?? null,
  };

  function act(action: PlayerAction) {
    playSound('buttonTap');
    state.act(action);
  }

  function answer(value: number) {
    const right = state.answer(value);
    playSound(right ? 'answerRight' : 'answerWrong');
    void (right ? haptics.success() : haptics.warning());
  }

  function openLevelMap() {
    if (daily) {
      router.back();
      return;
    }
    router.dismissTo({ pathname: '/levels/[mapId]', params: { mapId: String(mapId) } });
  }

  const todayBest = daily && dailyRecord.dayKey === state.dayKey ? dailyRecord : null;

  function renderPanel() {
    switch (status) {
      case 'question': {
        if (!question) {
          return null;
        }
        const format = (value: number) => formatAnswer(question.kind, value);
        return (
          <View style={styles.section}>
            <Text style={styles.prompt}>{questionPrompt(question.kind, false)}</Text>
            {spec!.answerInput === 'entry' ? (
              <CountEntry
                step={question.kind === 'decksRemaining' ? 0.5 : 1}
                min={question.kind === 'decksRemaining' ? 0.5 : -40}
                max={question.kind === 'decksRemaining' ? spec!.deckCount : 40}
                initial={question.kind === 'decksRemaining' ? spec!.deckCount / 2 : 0}
                format={format}
                onSubmit={answer}
                serial={hands}
              />
            ) : (
              <ChoiceGrid
                choices={question.choices}
                selected={null}
                correct={question.correct}
                disabled={false}
                format={format}
                onPress={answer}
              />
            )}
          </View>
        );
      }
      case 'bet':
        return (
          <View style={styles.section}>
            <Text style={styles.prompt}>SIZE YOUR BET</Text>
            <Text style={styles.sub}>True count, rounded down, minus one · 1 to {BET_SPREAD_MAX} units</Text>
            <CountEntry
              step={1}
              min={1}
              max={BET_SPREAD_MAX}
              initial={1}
              format={formatUnits}
              keyFormat={(value) => (value > 0 ? `+${value}` : `${value}`)}
              onSubmit={(value) => {
                setBetUnits(value);
                playSound('betPlaced');
                state.placeBet(value);
              }}
              serial={hands}
            />
          </View>
        );
      case 'insurance':
        return (
          <View style={styles.section}>
            <Text style={styles.prompt}>INSURANCE?</Text>
            <View style={styles.row}>
              <ArcadeButton label="Take it" variant="green" onPress={() => state.decideInsurance(true)} style={styles.grow} />
              <ArcadeButton label="No" variant="neutral" onPress={() => state.decideInsurance(false)} style={styles.grow} />
            </View>
          </View>
        );
      case 'play':
        return (
          <View style={styles.section}>
            <Text style={styles.prompt}>{indexSpot ? 'COUNT DECIDES THIS ONE' : 'YOUR PLAY'}</Text>
            <View style={styles.row}>
              {ACTIONS.map(({ action, label }) => (
                <ArcadeButton
                  key={action}
                  label={label}
                  size="small"
                  variant={hint === action ? 'gold' : 'neutral'}
                  disabled={!state.canAct(action)}
                  onPress={() => act(action)}
                  style={styles.grow}
                />
              ))}
            </View>
          </View>
        );
      case 'result': {
        const results = state.resolution?.hands.map((entry) => entry.result.toUpperCase()).join(' · ') ?? '';
        return (
          <View style={styles.section}>
            <Text style={styles.prompt}>{results}</Text>
            {state.lastHand ? (
              <Text style={styles.sub}>
                This hand {units(state.lastHand.you)}
                {spec!.betting ? ` · flat bettor ${units(state.lastHand.flat)}` : ''}
              </Text>
            ) : null}
            <ArcadeButton label="Next hand" size="large" onPress={state.nextHand} style={styles.stretch} />
          </View>
        );
      }
      case 'done':
        if (daily) {
          const edge = state.you - state.flat;
          return (
            <View style={styles.section}>
              <Text style={[styles.prompt, { color: backedOff ? colors.error : colors.goldBright }]}>
                {backedOff ? 'BACKED OFF' : `EDGE ${units(edge)}`}
              </Text>
              <Text style={styles.sub}>
                {backedOff
                  ? 'The pit boss saw the bet leap — no score today from that run.'
                  : `${Math.round((score?.accuracy ?? 0) * 100)}% right · your bets ${units(state.you)} vs flat ${units(state.flat)}`}
              </Text>
              {state.dailyResult?.edgeIsBest ? <Text style={styles.sub}>New best today</Text> : null}
              {state.dailyResult && state.dailyResult.chipsPaid > 0 ? (
                <Text style={styles.sub}>+{state.dailyResult.chipsPaid} chips for today’s shoe</Text>
              ) : null}
              <ArcadeButton label="Play it again" size="large" onPress={state.begin} style={styles.stretch} />
              <Text style={styles.link} onPress={openLevelMap} accessibilityRole="button">
                Back
              </Text>
            </View>
          );
        }
        if (stars >= 2) {
          return null;
        }
        return (
          <View style={styles.section}>
            <Text style={[styles.prompt, { color: colors.error }]}>
              {backedOff ? 'BACKED OFF' : 'NOT THIS TIME'}
            </Text>
            <Text style={styles.sub}>
              {backedOff
                ? 'The pit boss saw the bet leap. Climb the ramp a step or two a hand.'
                : `${Math.round((score?.accuracy ?? 0) * 100)}% right — ${Math.round(spec!.clearAccuracy * 100)}% clears it.`}
            </Text>
            {stars > 0 ? <Text style={styles.sub}>{starGlyphs(stars)} banked</Text> : null}
            <ArcadeButton label="Try again" size="large" onPress={state.begin} style={styles.stretch} />
            <Text style={styles.link} onPress={state.reset} accessibilityRole="button">
              Back to the brief
            </Text>
          </View>
        );
      default:
        return null;
    }
  }

  const scorecard: AccuracyRow[] = score
    ? [
        ...(Object.keys(score.byKind) as (keyof typeof KIND_LABEL)[])
          .filter((kind) => score.byKind[kind].calls > 0)
          .map((kind) => ({
            label: KIND_LABEL[kind],
            value: `${score.byKind[kind].right}/${score.byKind[kind].calls}`,
          })),
        ...(spec.betting ? [{ label: 'YOU VS FLAT', value: `${units(state.you)} vs ${units(state.flat)}` }] : []),
        { label: 'OVERALL', value: `${Math.round(score.accuracy * 100)}%`, strong: true },
      ]
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Image
        source={MODERN_TABLE_FELTS[map.feltKey] ?? TABLE_FELTS[map.feltKey] ?? TABLE_FELTS['gray-suede']}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <GameTableHud
        mapName={map.name}
        modeLabel={daily ? `Daily Shoe · ${state.dayKey ?? ''}` : `Level ${level} · ${spec.title}`}
        leftIcon={daily ? 'arrow-back' : 'map-outline'}
        leftAccessibilityLabel={daily ? 'Back' : 'Level map'}
        onOpenMaps={openLevelMap}
        onOpenSettings={() => setSettingsOpen(true)}
        menuOpen={settingsOpen}
      />
      {status === 'idle' ? null : <TrainingStatusStrip cells={cells} />}
      {spec.heat && status !== 'idle' ? (
        <View style={styles.heatTrack} accessibilityLabel={`Heat ${heat} of ${HEAT_LIMIT}`}>
          <View
            style={[
              styles.heatFill,
              { width: `${Math.min(100, (heat / HEAT_LIMIT) * 100)}%` },
              heat >= 60 && styles.heatHot,
            ]}
          />
          <Text style={styles.heatLabel}>PIT BOSS HEAT</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <TableCamera seated>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <FeltMarkings casinoName={map.name} align="top" topInset={0} modern />
          </View>
          {status === 'idle' ? null : (
            <TableStage
              table={table}
              seatCount={1}
              cardWidth={cardWidth}
              speed={1}
              distractions
              chipSetKey={map.chipSetKey}
              stake={map.chipDenominations[0] * (spec.betting ? Math.max(1, betUnits) : 1)}
              piles={
                shoe
                  ? { drawn: cardsDealt(shoe), remaining: cardsRemaining(shoe), totalCards, showScale: spec.deckCount > 1 }
                  : null
              }
            />
          )}
        </TableCamera>

        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + spacing.md }]}>
          {verdict && status !== 'idle' && status !== 'done' ? (
            <Animated.View key={verdict.serial} entering={FadeInDown.duration(180)} style={styles.verdictSlot}>
              <Text style={[styles.verdict, { color: verdict.right ? colors.success : colors.error }]}>
                {verdict.right ? '✓ ' : '✕ '}
                {verdict.text}
              </Text>
            </Animated.View>
          ) : null}
          {renderPanel()}
        </View>

        {status === 'idle' ? (
          <Animated.View entering={FadeIn.duration(200)} style={[styles.briefOverlay, { paddingBottom: insets.bottom + spacing.xs }]}>
            <ArcadeLevelBrief
              fit
              kicker={daily ? (state.dayKey ?? 'Today') : `Level ${level} · Boss`}
              title={spec.title}
              body={spec.brief}
              rules={
                daily
                  ? [
                      // No stars on the daily shoe — the edge is the score.
                      ...shoeRunChips(spec).filter((chip) => !chip.includes('clears')),
                      todayBest?.bestEdge != null
                        ? `Best today ${units(todayBest.bestEdge)} edge`
                        : 'First run seen through today pays 500 chips',
                    ]
                  : shoeRunChips(spec)
              }
              startLabel="Take a seat"
              onStart={() => {
                playSound('shuffle');
                state.begin();
              }}
              showCards={false}
            />
          </Animated.View>
        ) : null}
      </View>

      {!daily && status === 'done' && stars >= 2 ? (
        <FlashLevelCompleteOverlay
          mapName={map.name}
          level={level}
          stars={stars}
          xpAwarded={outcome?.firstClear ? DOJO_XP.flashLevel : 0}
          chipsAwarded={outcome?.chipsAwarded ?? 0}
          title={`${Math.round((score?.accuracy ?? 0) * 100)}% right${stars >= STAR_COUNT ? ' — flawless.' : '.'}`}
          body={
            spec.betting
              ? `Your bets ${units(state.you)} · one unit a hand ${units(state.flat)} on the same cards. ${
                  nextSpec ? `Next up: ${nextSpec.title}.` : ''
                }`
              : nextSpec
                ? `Next up: ${nextSpec.title}.`
                : 'The table is open.'
          }
          scorecard={scorecard}
          tableUnlocked={(outcome?.tableUnlocked ?? false) && nextMap !== undefined}
          nextMapName={nextMap?.name}
          tableOpen={tableOpen}
          onNextLevel={() =>
            router.replace({ pathname: '/flash/[mapId]/[level]', params: { mapId: String(mapId), level: String(level + 1) } })
          }
          onSitAtTable={() => router.dismissTo({ pathname: '/game/[mapId]', params: { mapId: String(mapId) } })}
          onQuiz={() => router.replace({ pathname: '/quiz/[mapId]', params: { mapId: String(mapId) } })}
          onLevelMap={openLevelMap}
          onReplay={state.reset}
        />
      ) : null}

      <GameSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} mapId={mapId} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  heatTrack: {
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.xs,
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heatFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.warning,
  },
  heatHot: {
    backgroundColor: colors.error,
  },
  heatLabel: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  bottomPanel: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xs,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  briefOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.md,
  },
  section: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  prompt: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1,
    textAlign: 'center',
  },
  sub: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  grow: {
    flex: 1,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  link: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
  verdictSlot: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  verdict: {
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
});
