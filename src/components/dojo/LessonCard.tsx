import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lesson, LessonStep } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';
import { DojoButton } from './DojoButton';

interface LessonCardProps {
  readonly lesson: Lesson;
  readonly step: LessonStep;
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly onAction?: () => void;
  readonly onNext?: () => void;
  readonly isLastStep: boolean;
}

export function LessonCard({
  lesson,
  step,
  stepIndex,
  totalSteps,
  onAction,
  onNext,
  isLastStep,
}: LessonCardProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.kicker}>
          LESSON {lesson.order} · STEP {stepIndex + 1} / {totalSteps}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{lesson.subtitle}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((stepIndex + 1) / totalSteps) * 100}%` }]} />
      </View>

      <View style={styles.bodyCard}>
        <Text style={styles.body}>{step.body}</Text>
      </View>

      <View style={styles.actions}>
        {step.actionLabel && onAction ? (
          <DojoButton label={step.actionLabel} onPress={onAction} />
        ) : null}
        {onNext ? (
          <DojoButton
            label={isLastStep ? 'Complete Lesson' : 'Next'}
            variant={step.actionLabel ? 'secondary' : 'primary'}
            onPress={onNext}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.gold,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  bodyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 24,
  },
  actions: {
    gap: spacing.md,
  },
});
