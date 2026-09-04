import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/common/AppScreen';
import { ScreenTitleRow } from '../../components/common/ScreenTitleRow';
import { SectionCard } from '../../components/common/SectionCard';
import { ProgressionHeader } from '../../components/progression/ProgressionHeader';
import { StreakFlame } from '../../components/dojo/StreakFlame';
import { DOJO_LESSONS, isDojoGraduate } from '../../engine/dojo';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';

export default function ReviewScreen() {
  const completed = useDojoStore((state) => state.completedLessons);
  const rank = useDojoStore((state) => state.rank);
  const dailyStreak = useDojoStore((state) => state.dailyStreak);
  const drillBests = useDojoStore((state) => state.drillBests);
  const totalXp = useDojoStore((state) => state.totalDojoXp);

  const lessonsDone = DOJO_LESSONS.filter((l) => completed.has(l.id)).length;
  const graduate = isDojoGraduate(completed);

  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="Review" />
      <View style={styles.stack}>
        <SectionCard title="Dojo Rank">
          <Text style={styles.rank}>{rank.title}</Text>
          <Text style={styles.body}>{rank.subtitle}</Text>
          <Text style={styles.body}>Total dojo XP: {totalXp}</Text>
        </SectionCard>

        <SectionCard title="Daily Streak">
          <StreakFlame streak={dailyStreak} />
        </SectionCard>

        <SectionCard title="Lessons">
          <Text style={styles.body}>
            {lessonsDone} / {DOJO_LESSONS.length} completed
          </Text>
          {graduate ? <Text style={styles.graduate}>🎓 Dojo Graduate</Text> : null}
        </SectionCard>

        <SectionCard title="Drill Bests">
          <View style={styles.drillRow}>
            <Text style={styles.drillName}>Value Flash</Text>
            <Text style={styles.drillScore}>
              {drillBests.values ? `${Math.round(drillBests.values.accuracy * 100)}%` : '—'}
            </Text>
          </View>
          <View style={styles.drillRow}>
            <Text style={styles.drillName}>Running Count</Text>
            <Text style={styles.drillScore}>
              {drillBests.running ? `${Math.round(drillBests.running.accuracy * 100)}%` : '—'}
            </Text>
          </View>
          <View style={styles.drillRow}>
            <Text style={styles.drillName}>Speed Count</Text>
            <Text style={styles.drillScore}>
              {drillBests.speed ? `${Math.round(drillBests.speed.accuracy * 100)}%` : '—'}
            </Text>
          </View>
        </SectionCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  rank: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  graduate: {
    color: colors.success,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    marginTop: spacing.sm,
  },
  drillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  drillName: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
  },
  drillScore: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
});
