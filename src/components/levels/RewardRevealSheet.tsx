import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { REWARD_ART } from '../../assets/registry';
import { CasinoMap } from '../../engine/betting/casino';
import { mapRewards, RewardSlot } from '../../engine/dojo';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors, fonts, fontSizes, fontWeights, spacing } from '../../theme';
import { ArcadeButton, ArcadePanel, ArcadePlaque } from '../arcade';
import { formatChips } from '../../utils/format';

interface RewardRevealSheetProps {
  readonly visible: boolean;
  readonly map: CasinoMap;
  readonly slot: RewardSlot;
  /** Chips the bag just paid; 0 when it was opened before. */
  readonly chips: number;
  /** The gift's tool goes to the table; the bag's drill can be played now. */
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

const HALO_MS = 1400;

/**
 * Opening a mystery reward: the wrap falls away and the prize lands on the
 * casino's own panel — the gift's table tool, or the bag's chips and the
 * drill it carries. The halo behind the art breathes while it is up.
 */
export function RewardRevealSheet({
  visible,
  map,
  slot,
  chips,
  onConfirm,
  onClose,
}: RewardRevealSheetProps) {
  const reducedMotion = useReducedMotion();
  const halo = useSharedValue(0);

  useEffect(() => {
    if (visible && !reducedMotion) {
      halo.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: HALO_MS, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: HALO_MS, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(halo);
      halo.set(visible ? 0.6 : 0);
    }
    return () => cancelAnimation(halo);
  }, [visible, reducedMotion, halo]);

  const haloStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.45 + halo.value * 0.45,
    shadowRadius: 16 + halo.value * 22,
    transform: [{ scale: 1 + halo.value * 0.03 }],
  }));

  const rewards = mapRewards(map.id);
  if (!rewards) {
    return null;
  }
  const gift = slot === 1;
  const art = gift ? REWARD_ART.tool[rewards.tool.id] : REWARD_ART.drill[rewards.drill.id];
  const title = gift ? rewards.tool.name : rewards.drill.name;
  const body = gift ? rewards.tool.blurb : rewards.drill.blurb;
  const note = gift
    ? 'It sits on the table from now on — switch it off in the ≡ menu when you no longer need it.'
    : `A taste of ${rewards.drill.teases}. Replay it any time from the bag — no stars, no strikes.`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={styles.root}
        entering={reducedMotion ? undefined : FadeIn.duration(180)}
        exiting={reducedMotion ? undefined : FadeOut.duration(160)}
      >
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
        <Animated.View
          style={styles.sheet}
          entering={reducedMotion ? undefined : ZoomIn.springify().damping(14)}
        >
          <ArcadePanel slab style={styles.panel}>
            <ArcadePlaque kicker="Mystery reward" title={map.name} />
            <Animated.View style={[styles.artSlot, haloStyle]}>
              <Image source={art} style={styles.art} contentFit="contain" transition={160} />
            </Animated.View>
            {chips > 0 ? (
              <Text style={styles.chips}>+{formatChips(chips)} chips</Text>
            ) : null}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Text style={styles.note}>{note}</Text>
            <ArcadeButton
              label={gift ? 'Put it on the table' : 'Play it now'}
              size="large"
              onPress={onConfirm}
              style={styles.cta}
            />
            <Text style={styles.later} onPress={onClose} accessibilityRole="button">
              Later
            </Text>
          </ArcadePanel>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.arcadeNightShade,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    alignSelf: 'stretch',
    maxWidth: 380,
    width: '100%',
  },
  panel: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  artSlot: {
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.arcadeGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  art: {
    width: 148,
    height: 148,
  },
  chips: {
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 1,
    color: colors.arcadeMint,
    includeFontPadding: false,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 1,
    color: colors.arcadeGold,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: colors.chipShadow,
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
  body: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    lineHeight: fontSizes.caption + 7,
    color: colors.arcadeCream,
    textAlign: 'center',
  },
  note: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption,
    lineHeight: fontSizes.caption + 5,
    color: colors.arcadeMuted,
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  later: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    color: colors.arcadeMuted,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
});
