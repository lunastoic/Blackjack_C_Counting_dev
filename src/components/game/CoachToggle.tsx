import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CountCoachLevel } from '../../engine/types';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { COUNT_COACH_LABELS, nextCountCoachLevel } from '../../utils/countCoach';
import { ArcadeBevel, arcadeShadow } from '../arcade';
import { PressableScale } from '../common/PressableScale';
import { TRAINING_TOGGLE_WIDTH } from './TrainingToggle';

interface CoachToggleProps {
  readonly level: CountCoachLevel;
  readonly onSelect: (level: CountCoachLevel) => void;
}

const ICONS: Record<CountCoachLevel, React.ComponentProps<typeof Ionicons>['name']> = {
  off: 'eye-off-outline',
  learn: 'school-outline',
  full: 'school',
};

/**
 * Table-side Count Coach switch — the same upright tab on the felt's right
 * rail the Training switch used, flipping Off ↔ On on each tap, live at any
 * point in the hand. On is gold and lit (the fogged meter to prove, then the
 * rail, glows, hints, charts and bet tips); Off is the bare casino. Legacy
 * Learn still draws (dimmer) should a save carry it before the migration runs.
 */
export function CoachToggle({ level, onSelect }: CoachToggleProps) {
  const lit = level !== 'off';
  const next = nextCountCoachLevel(level);
  const modern = useModernUi();

  if (modern) {
    const full = level === 'full';
    return (
      <PressableScale
        onPress={() => onSelect(next)}
        accessibilityRole="button"
        accessibilityLabel={`Count Coach: ${COUNT_COACH_LABELS[level]}`}
        accessibilityHint={`Switches to ${COUNT_COACH_LABELS[next]}`}
        hitSlop={spacing.sm}
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
          <Ionicons name={ICONS[level]} size={22} color={colors.arcadeGold} />
          <Text style={styles.modernLabel} numberOfLines={1}>
            COACH
          </Text>
          <ArcadeBevel
            face={full ? colors.arcadeGold : colors.arcadeNeutral}
            deep={full ? colors.arcadeGoldDeep : colors.arcadeNeutralDeep}
            drop={2}
            outline={2}
            band={2}
            radius={8}
            style={styles.modernState}
            faceStyle={styles.modernStateFace}
          >
            <Text
              style={[styles.modernStateText, !full && styles.modernStateTextDim]}
              numberOfLines={1}
            >
              {COUNT_COACH_LABELS[level].toUpperCase()}
            </Text>
          </ArcadeBevel>
        </ArcadeBevel>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      style={[styles.tab, lit ? styles.tabOn : styles.tabOff, level === 'learn' && styles.tabLearn]}
      onPress={() => onSelect(next)}
      accessibilityRole="button"
      accessibilityLabel={`Count Coach: ${COUNT_COACH_LABELS[level]}`}
      accessibilityHint={`Switches to ${COUNT_COACH_LABELS[next]}`}
    >
      <Ionicons name={ICONS[level]} size={20} color={lit ? colors.goldBright : colors.textMuted} />
      <Text style={[styles.label, lit ? styles.labelOn : styles.labelOff]} numberOfLines={1}>
        COACH
      </Text>
      <View style={[styles.state, STATE_STYLES[level]]}>
        <Text style={[styles.stateText, STATE_TEXT_STYLES[level]]} numberOfLines={1}>
          {COUNT_COACH_LABELS[level].toUpperCase()}
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
  tabLearn: {
    shadowOpacity: 0.15,
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
  stateFull: {
    backgroundColor: colors.gold,
    borderColor: colors.goldBright,
  },
  stateLearn: {
    backgroundColor: 'transparent',
    borderColor: colors.borderGold,
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
  stateTextFull: {
    color: colors.burgundyDeep,
  },
  stateTextLearn: {
    color: colors.goldBright,
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

const STATE_STYLES: Record<CountCoachLevel, object> = {
  off: styles.stateOff,
  learn: styles.stateLearn,
  full: styles.stateFull,
};

const STATE_TEXT_STYLES: Record<CountCoachLevel, object> = {
  off: styles.stateTextOff,
  learn: styles.stateTextLearn,
  full: styles.stateTextFull,
};
