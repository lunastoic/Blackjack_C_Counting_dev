import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/common/AppScreen';
import { ScreenTitleRow } from '../../components/common/ScreenTitleRow';
import { ProgressionHeader } from '../../components/progression/ProgressionHeader';
import { DojoButton } from '../../components/dojo/DojoButton';
import { DOJO_LESSONS } from '../../engine/dojo';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

const ICONS: Record<string, string> = {
  cards: '🃏',
  count: '🔢',
  eye: '👁',
  divide: '➗',
  table: '🎰',
  chips: '🪙',
};

export default function LearnIndexScreen() {
  const router = useRouter();
  const completed = useDojoStore((state) => state.completedLessons);
  const isLessonUnlocked = useDojoStore((state) => state.isLessonUnlocked);
  const rank = useDojoStore((state) => state.rank);

  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="Learn" />
      <Text style={styles.intro}>
        Six interactive lessons take you from raw beginner to confident counter. Complete each one
        to unlock the next.
      </Text>
      <View style={styles.grid}>
        {DOJO_LESSONS.map((lesson) => {
          const done = completed.has(lesson.id);
          const unlocked = isLessonUnlocked(lesson.id);
          const lockedByRank = lesson.requiredRank > rank.index;
          return (
            <View key={lesson.id} style={[styles.card, done && styles.cardDone, !unlocked && styles.cardLocked]}>
              <Text style={styles.icon}>{ICONS[lesson.icon] ?? '🃏'}</Text>
              <Text style={styles.title}>{lesson.title}</Text>
              <Text style={styles.subtitle}>{lesson.subtitle}</Text>
              {done ? (
                <Text style={styles.badgeDone}>COMPLETED</Text>
              ) : lockedByRank ? (
                <Text style={styles.badgeLocked}>RANK {DOJO_LESSONS[lesson.requiredRank]?.title ?? ''}</Text>
              ) : (
                <DojoButton
                  label={unlocked ? 'Start' : 'Locked'}
                  variant="secondary"
                  disabled={!unlocked}
                  onPress={() => router.push({ pathname: '/learn/[lessonId]', params: { lessonId: lesson.id } })}
                />
              )}
            </View>
          );
        })}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  grid: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardDone: {
    borderColor: colors.success,
    opacity: 0.85,
  },
  cardLocked: {
    opacity: 0.6,
  },
  icon: {
    fontSize: fontSizes.title,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    lineHeight: 20,
  },
  badgeDone: {
    color: colors.success,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  badgeLocked: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
});
