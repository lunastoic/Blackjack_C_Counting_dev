import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { TABLE_FELTS } from '../../assets/registry';
import { colors, layout, spacing } from '../../theme';
import { FeltMarkings } from './FeltMarkings';
import { TRAINING_TOGGLE_WIDTH } from './TrainingToggle';

/**
 * The table surface every casino screen sits on: the felt, its tint, and the
 * house lettering printed on it. It fills the screen behind everything and
 * belongs to no layout or camera, so the print is at the same spot on the
 * game table and in the Count Sprint and never moves — cards, chips and
 * prompts simply land on top of it, like on a real layout.
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
}

export function FeltBackdrop({ feltKey, casinoName }: FeltBackdropProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={TABLE_FELTS[feltKey] ?? TABLE_FELTS['gray-suede']}
        style={styles.felt}
        resizeMode="cover"
      />
      <View style={styles.tint} />
      <FeltMarkings
        casinoName={casinoName}
        anchor={FELT_LETTERING_ANCHOR}
        sideInset={FELT_LETTERING_SIDE_INSET}
      />
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
