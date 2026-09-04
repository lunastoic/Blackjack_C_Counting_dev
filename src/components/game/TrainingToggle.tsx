import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { PressableScale } from '../common/PressableScale';

interface TrainingToggleProps {
  readonly enabled: boolean;
  readonly onToggle: (enabled: boolean) => void;
}

/** Tab width — the felt lettering keeps clear of it. */
export const TRAINING_TOGGLE_WIDTH = 62;

/**
 * Table-side Training Mode switch — a small upright tab on the felt's right
 * rail. On: gold and lit (live counts, count rail, card underglow, strategy
 * hints). Off: dark and dimmed (casino-real play, counts fogged to "?").
 */
export function TrainingToggle({ enabled, onToggle }: TrainingToggleProps) {
  return (
    <PressableScale
      style={[styles.tab, enabled ? styles.tabOn : styles.tabOff]}
      onPress={() => onToggle(!enabled)}
      accessibilityRole="switch"
      accessibilityLabel="Training mode"
      accessibilityState={{ checked: enabled }}
      accessibilityHint={
        enabled
          ? 'Turns off the live count, count rail, card glow and strategy hints'
          : 'Turns on the live count, count rail, card glow and strategy hints'
      }
    >
      <Ionicons
        name={enabled ? 'school' : 'school-outline'}
        size={20}
        color={enabled ? colors.goldBright : colors.textMuted}
      />
      <Text style={[styles.label, enabled ? styles.labelOn : styles.labelOff]} numberOfLines={1}>
        TRAINING
      </Text>
      <View style={[styles.state, enabled ? styles.stateOn : styles.stateOff]}>
        <Text style={[styles.stateText, enabled ? styles.stateTextOn : styles.stateTextOff]}>
          {enabled ? 'ON' : 'OFF'}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tab: {
    width: TRAINING_TOGGLE_WIDTH,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  tabOn: {
    backgroundColor: colors.burgundy,
    borderColor: colors.borderGold,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tabOff: {
    backgroundColor: 'rgba(12, 10, 9, 0.6)',
    borderColor: colors.borderSubtle,
  },
  label: {
    fontSize: 8,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.4,
  },
  labelOn: {
    color: colors.goldBright,
  },
  labelOff: {
    color: colors.textMuted,
  },
  state: {
    minWidth: 34,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  stateOn: {
    backgroundColor: colors.gold,
    borderColor: colors.goldBright,
  },
  stateOff: {
    backgroundColor: 'transparent',
    borderColor: colors.borderSubtle,
  },
  stateText: {
    fontSize: fontSizes.caption - 2,
    fontWeight: fontWeights.heavy,
    letterSpacing: 0.8,
  },
  stateTextOn: {
    color: colors.burgundyDeep,
  },
  stateTextOff: {
    color: colors.textMuted,
  },
});
