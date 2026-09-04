import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '../common/PressableScale';
import { PrimaryButton } from '../common/PrimaryButton';
import { haptics } from '../../services/haptics';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';
import { formatCount } from '../../utils/countCoach';

const MIN_COUNT = -15;
const MAX_COUNT = 15;

interface QuizCountEntryProps {
  readonly onSubmit: (value: number) => void;
}

/**
 * High-tier answer input: no multiple choice to lean on — dial in the exact
 * count with −/+ and lock it in. Mounts fresh (at 0) for every question.
 */
export function QuizCountEntry({ onSubmit }: QuizCountEntryProps) {
  const [value, setValue] = useState(0);

  function step(delta: number) {
    setValue((current) => {
      const next = Math.max(MIN_COUNT, Math.min(MAX_COUNT, current + delta));
      if (next !== current) {
        void haptics.selection();
      }
      return next;
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.stepperRow}>
        <PressableScale
          onPress={() => step(-1)}
          accessibilityLabel="Decrease count"
          style={styles.stepButton}
        >
          <Text style={styles.stepGlyph}>−</Text>
        </PressableScale>
        <View style={styles.valueBox}>
          <Text style={styles.valueText}>{formatCount(value)}</Text>
        </View>
        <PressableScale
          onPress={() => step(1)}
          accessibilityLabel="Increase count"
          style={styles.stepButton}
        >
          <Text style={styles.stepGlyph}>+</Text>
        </PressableScale>
      </View>
      <PrimaryButton
        label={`Lock in ${formatCount(value)}`}
        onPress={() => onSubmit(value)}
        accessibilityHint="Submits this running count as your answer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  stepGlyph: {
    color: colors.gold,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    lineHeight: 34,
  },
  valueBox: {
    minWidth: 96,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  valueText: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
});
