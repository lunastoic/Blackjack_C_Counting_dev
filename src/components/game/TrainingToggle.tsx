import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { ArcadeBevel, arcadeShadow } from '../arcade';
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
  const modern = useModernUi();

  if (modern) {
    return (
      <PressableScale
        onPress={() => onToggle(!enabled)}
        accessibilityRole="switch"
        accessibilityLabel="Training mode"
        accessibilityState={{ checked: enabled }}
        accessibilityHint={
          enabled
            ? 'Turns off the live count, count rail, card glow and strategy hints'
            : 'Turns on the live count, count rail, card glow and strategy hints'
        }
        style={styles.modernTab}
      >
        <ArcadeBevel
          face={colors.arcadePlaque}
          deep={colors.arcadePlaqueDeep}
          drop={3}
          outline={2}
          band={3}
          radius={radii.md}
          faceStyle={styles.modernFace}
        >
          <Ionicons
            name={enabled ? 'school' : 'school-outline'}
            size={22}
            color={colors.arcadeGold}
          />
          <Text style={styles.modernLabel} numberOfLines={1}>
            TRAINING
          </Text>
          <ArcadeBevel
            face={enabled ? colors.arcadeGold : colors.arcadeNeutral}
            deep={enabled ? colors.arcadeGoldDeep : colors.arcadeNeutralDeep}
            drop={2}
            outline={2}
            band={2}
            radius={8}
            style={styles.modernState}
            faceStyle={styles.modernStateFace}
          >
            <Text style={[styles.modernStateText, !enabled && styles.modernStateTextDim]}>
              {enabled ? 'ON' : 'OFF'}
            </Text>
          </ArcadeBevel>
        </ArcadeBevel>
      </PressableScale>
    );
  }

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
  /* Modern */
  modernTab: {
    width: TRAINING_TOGGLE_WIDTH,
  },
  modernFace: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm + spacing.xxs,
    paddingHorizontal: 2,
  },
  modernLabel: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 15,
    letterSpacing: 1,
    color: colors.arcadeGold,
    includeFontPadding: false,
    ...arcadeShadow.soft,
  },
  modernState: {
    marginTop: 2,
  },
  modernStateFace: {
    paddingHorizontal: 7,
    paddingBottom: 2,
    alignItems: 'center',
  },
  modernStateText: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 1,
    color: colors.arcadeInkOnLight,
    includeFontPadding: false,
  },
  modernStateTextDim: {
    color: colors.arcadeCream,
    ...arcadeShadow.soft,
  },
});
