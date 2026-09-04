import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/common/AppScreen';
import { ProgressionHeader } from '../../components/progression/ProgressionHeader';
import { LessonCard } from '../../components/dojo/LessonCard';
import { TipToast } from '../../components/dojo/TipToast';
import { lessonById, LessonId, HI_LO_GROUPS } from '../../engine/dojo';
import { hiLoValue } from '../../engine/cards/card';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

const VALID_LESSON_IDS: readonly LessonId[] = [
  'hi-lo-values',
  'running-count',
  'hole-card-rule',
  'true-count',
  'count-and-play',
  'betting-by-count',
];

export default function LessonScreen() {
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const parsedId = VALID_LESSON_IDS.find((id) => id === lessonId);
  const lesson = parsedId ? lessonById(parsedId) : undefined;

  const completeLesson = useDojoStore((state) => state.completeLesson);
  const [stepIndex, setStepIndex] = useState(0);
  const [showGlow, setShowGlow] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  if (!lesson) {
    return (
      <AppScreen header={<ProgressionHeader />}>
        <Text style={styles.error}>Lesson not found.</Text>
      </AppScreen>
    );
  }
  const currentLesson = lesson;

  const step = currentLesson.steps[stepIndex];
  const isLastStep = stepIndex === currentLesson.steps.length - 1;

  function handleAction() {
    if (currentLesson.id === 'hi-lo-values') {
      if (step.id === 'low-cards' || step.id === 'high-cards') {
        setShowGlow(true);
      }
      if (step.id === 'summary') {
        setTip('2–6 = +1, 7–9 = 0, 10–A = −1. Memorize this before moving on.');
      }
    }
    if (currentLesson.id === 'hole-card-rule') {
      setTip('The face-down hole card does NOT count until the dealer flips it.');
    }
  }

  function handleNext() {
    if (isLastStep) {
      completeLesson(currentLesson.id);
      router.replace('/learn');
      return;
    }
    setStepIndex(stepIndex + 1);
  }

  return (
    <AppScreen header={<ProgressionHeader />}>
      <View style={styles.root}>
        <LessonCard
          lesson={currentLesson}
          step={step}
          stepIndex={stepIndex}
          totalSteps={currentLesson.steps.length}
          onAction={step.actionLabel ? handleAction : undefined}
          onNext={handleNext}
          isLastStep={isLastStep}
        />

        {lesson.id === 'hi-lo-values' && step.id !== 'intro' ? (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Hi-Lo groups</Text>
            <View style={styles.groups}>
              {([1, 0, -1] as const).map((value) => {
                const group = HI_LO_GROUPS[value];
                return (
                  <View key={value} style={styles.group}>
                    <Text
                      style={[
                        styles.groupValue,
                        group.color === 'plus' && styles.plus,
                        group.color === 'minus' && styles.minus,
                        group.color === 'neutral' && styles.neutral,
                      ]}
                    >
                      {group.label}
                    </Text>
                    <Text style={styles.groupCards}>{group.ranks.join(' ')}</Text>
                  </View>
                );
              })}
            </View>
            {showGlow ? (
              <View style={styles.miniCardRow}>
                {['2', '7', 'K'].map((rank, i) => {
                  const color =
                    hiLoValue(rank as never) > 0
                      ? colors.trainingPlus
                      : hiLoValue(rank as never) < 0
                        ? colors.trainingMinus
                        : colors.trainingNeutral;
                  return (
                    <View
                      key={rank}
                      style={[
                        styles.miniCard,
                        { borderColor: color, shadowColor: color },
                      ]}
                    >
                      <Text style={[styles.miniCardValue, { color }]}>
                        {hiLoValue(rank as never) > 0 ? '+1' : hiLoValue(rank as never) < 0 ? '−1' : '0'}
                      </Text>
                      <Text style={styles.miniCardRank}>{rank}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {tip ? <TipToast message={tip} variant="info" onDismiss={() => setTip(null)} /> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  error: {
    color: colors.error,
    fontSize: fontSizes.body,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  demo: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  demoTitle: {
    color: colors.gold,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
  },
  groups: {
    gap: spacing.sm,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupValue: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    width: 40,
  },
  plus: { color: colors.trainingPlus },
  minus: { color: colors.trainingMinus },
  neutral: { color: colors.trainingNeutral },
  groupCards: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },
  miniCardRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  miniCard: {
    width: 60,
    height: 80,
    borderRadius: radii.md,
    borderWidth: 2,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  miniCardValue: {
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  miniCardRank: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
  },
});
