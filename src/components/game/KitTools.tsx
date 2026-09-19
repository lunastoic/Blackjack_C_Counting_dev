import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { BET_SPREAD_MAX } from '../../engine/betting/betRamp';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fonts, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { PressableScale } from '../common/PressableScale';

/**
 * The counter's kit at the table — the tools won from the gifts on the
 * trails. Each is the player's own aid: it never reveals the count, only
 * what a counter would have written on a card in their pocket.
 */

const HI_LO_ROWS: readonly { readonly value: string; readonly ranks: string; readonly color: string }[] = [
  { value: '+1', ranks: '2 – 6', color: colors.arcadeMint },
  { value: '0', ranks: '7 – 9', color: colors.arcadeMuted },
  { value: '−1', ranks: '10 – A', color: colors.arcadeLoss },
];

/** Luna Luxe's gift: the Hi-Lo chart on a card tucked into the table's edge. */
export function HiLoPocketCard() {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  return (
    <View style={styles.pocketSlot} pointerEvents="box-none">
      <PressableScale
        accessibilityLabel={open ? 'Hide the Hi-Lo card' : 'Peek at the Hi-Lo card'}
        onPress={() => setOpen((shown) => !shown)}
        style={styles.pocketRow}
      >
        {open ? (
          <Animated.View
            style={styles.pocketCard}
            entering={reducedMotion ? undefined : FadeIn.duration(140)}
            exiting={reducedMotion ? undefined : FadeOut.duration(120)}
          >
            {HI_LO_ROWS.map((row) => (
              <View key={row.value} style={styles.pocketLine}>
                <Text style={[styles.pocketValue, { backgroundColor: row.color }]}>{row.value}</Text>
                <Text style={styles.pocketRanks}>{row.ranks}</Text>
              </View>
            ))}
          </Animated.View>
        ) : null}
        <View style={styles.pocketTab}>
          <Text style={styles.pocketTabText}>HI-LO</Text>
        </View>
      </PressableScale>
    </View>
  );
}

/** How long the pair spotter's call-out hangs on the felt. */
const PAIR_MS = 900;

/** Io's gift: a beat of mint when two cards in a row cancel each other out. */
export function PairSpotter() {
  const pulse = useGameSessionStore((state) => state.cancelPulse);
  const reducedMotion = useReducedMotion();
  /** The pulse whose beat has passed. */
  const [expired, setExpired] = useState(0);

  useEffect(() => {
    if (pulse === 0) {
      return;
    }
    const timer = setTimeout(() => setExpired(pulse), PAIR_MS);
    return () => clearTimeout(timer);
  }, [pulse]);

  const shown = pulse !== 0 && pulse !== expired ? pulse : 0;
  if (shown === 0) {
    return null;
  }
  return (
    <View style={styles.pairSlot} pointerEvents="none">
      <Animated.View
        key={shown}
        style={styles.pairPill}
        entering={reducedMotion ? undefined : ZoomIn.duration(160)}
        exiting={reducedMotion ? undefined : FadeOut.duration(180)}
      >
        <Ionicons name="swap-horizontal" size={14} color={colors.arcadeMint} />
        <Text style={styles.pairText}>They cancel · 0</Text>
      </Animated.View>
    </View>
  );
}

/** Titan's gift: the bet ramp pinned over the chips while a bet is sized. */
export function BetRampCard() {
  const steps = Array.from({ length: BET_SPREAD_MAX }, (_, index) => ({
    label: index === 0 ? '≤+2' : `+${index + 2}`,
    units: index + 1,
  }));
  return (
    <View style={styles.ramp} accessibilityLabel="Bet ramp: true count minus one, one to eight units">
      <Text style={styles.rampHead}>BET RAMP · TC − 1</Text>
      <View style={styles.rampRow}>
        {steps.map((step) => (
          <View key={step.units} style={styles.rampStep}>
            <View style={[styles.rampBar, { height: 5 + step.units * 4 }]} />
            <Text style={styles.rampCount}>{step.label}</Text>
            <Text style={styles.rampUnits}>{step.units}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Europa's gift: deck marks up the side of the discard tray. */
export function TrayMarks({
  decks,
  height,
  flip = false,
}: {
  readonly decks: number;
  readonly height: number;
  /** Marks on the tray's left: the number first, then the tick. */
  readonly flip?: boolean;
}) {
  const marks = Array.from({ length: Math.max(1, decks) }, (_, index) => index + 1);
  return (
    <View style={[styles.trayMarks, { height }]} pointerEvents="none">
      {marks.map((deck) => (
        <View key={deck} style={[styles.trayMark, flip && styles.trayMarkFlip]}>
          <View style={styles.trayTick} />
          <Text style={styles.trayLabel}>{deck}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pocketSlot: {
    position: 'absolute',
    left: 0,
    top: '42%',
    zIndex: 6,
  },
  pocketRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pocketCard: {
    backgroundColor: colors.arcadeCream,
    borderColor: colors.arcadeGold,
    borderWidth: 3,
    borderLeftWidth: 0,
    borderTopRightRadius: radii.md,
    borderBottomRightRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    gap: spacing.xs,
    ...shadows.overlay,
  },
  pocketLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pocketValue: {
    minWidth: 30,
    textAlign: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.arcadeInkOnLight,
    includeFontPadding: false,
  },
  pocketRanks: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.arcadeInkOnLight,
    includeFontPadding: false,
  },
  pocketTab: {
    backgroundColor: colors.arcadePlaque,
    borderWidth: 2,
    borderLeftWidth: 0,
    borderColor: colors.arcadeInk,
    borderTopRightRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 3,
  },
  pocketTabText: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.arcadeGold,
    includeFontPadding: false,
  },
  pairSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '34%',
    alignItems: 'center',
    zIndex: 6,
  },
  pairPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.arcadeToastFill,
    borderWidth: 2,
    borderColor: colors.arcadeMint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  pairText: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    color: colors.arcadeMint,
  },
  ramp: {
    alignSelf: 'stretch',
    backgroundColor: colors.arcadeCream,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.arcadeGold,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  rampHead: {
    fontFamily: fonts.display,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.arcadeInkOnLight,
    textAlign: 'center',
    includeFontPadding: false,
  },
  rampRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xxs,
  },
  rampStep: {
    flex: 1,
    alignItems: 'center',
  },
  rampBar: {
    width: 12,
    borderRadius: 2,
    backgroundColor: colors.arcadeGreen,
  },
  rampCount: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: fontWeights.bold,
    color: colors.arcadeInkOnLight,
  },
  rampUnits: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.arcadeInkOnLight,
    includeFontPadding: false,
  },
  trayMarks: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  trayMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trayMarkFlip: {
    flexDirection: 'row-reverse',
  },
  trayTick: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.arcadeGold,
    opacity: 0.85,
  },
  trayLabel: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.arcadeGold,
    includeFontPadding: false,
  },
});
