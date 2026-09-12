import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MODERN_TABLE_FELTS, TABLE_FELTS } from '../../assets/registry';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, layout, spacing } from '../../theme';
import { FeltMarkings } from './FeltMarkings';
import { FELT_SIT_DROP, FELT_SIT_SCALE, useSeatedProgress } from './TableCamera';
import { TRAINING_TOGGLE_WIDTH } from './TrainingToggle';

/**
 * The table surface every casino screen sits on: the felt, its tint, and the
 * house lettering printed on it. It fills the screen behind everything and
 * belongs to no layout, so the print is at the same spot on the game table
 * and in the Count Sprint — cards, chips and prompts simply land on top of
 * it, like on a real layout.
 *
 * On the game table the felt is part of the camera: pass `seated` and, on
 * Deal, the whole surface — lettering included — comes closer in step with
 * the play content, as if the player pulled up a chair. Left out, the felt
 * holds still.
 */

/**
 * Title arc, as a fraction of the screen: the open felt between the dealer's
 * cards and the player's spot, under the dealer's hand total and above the
 * result badge.
 */
export const FELT_LETTERING_ANCHOR = 0.51;
/** The arcs stay clear of the Training tab parked on the right rail (mirrored so they stay centred). */
export const FELT_LETTERING_SIDE_INSET = TRAINING_TOGGLE_WIDTH + layout.screenPaddingH + spacing.sm;

interface FeltBackdropProps {
  readonly feltKey: string;
  readonly casinoName: string;
  /** Sit the felt down with the table camera (game table only). */
  readonly seated?: boolean;
}

export function FeltBackdrop({ feltKey, casinoName, seated }: FeltBackdropProps) {
  const { width } = useWindowDimensions();
  const modern = useModernUi();
  // The Modern felt carries its own vignette; the Classic one takes a flat tint.
  const modernFelt = modern ? MODERN_TABLE_FELTS[feltKey] : undefined;
  const progress = useSeatedProgress(seated ?? false);
  // A felt on the camera grows about the screen centre when the player sits,
  // so its arcs are fitted to clear the rails at the seated size — the same
  // fit standing, so the print never re-flows mid-move.
  const half = width / 2;
  const sideInset =
    seated === undefined
      ? FELT_LETTERING_SIDE_INSET
      : half - (half - FELT_LETTERING_SIDE_INSET) / FELT_SIT_SCALE;
  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: FELT_SIT_DROP * progress.value },
      { scale: 1 + (FELT_SIT_SCALE - 1) * progress.value },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, surfaceStyle]}>
        <Image
          source={modernFelt ?? TABLE_FELTS[feltKey] ?? TABLE_FELTS['gray-suede']}
          style={styles.felt}
          contentFit="cover"
        />
        {modernFelt ? null : <View style={styles.tint} />}
        <FeltMarkings
          casinoName={casinoName}
          anchor={FELT_LETTERING_ANCHOR}
          sideInset={sideInset}
          modern={modern}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  felt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: undefined,
    height: undefined,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayLight,
  },
});
