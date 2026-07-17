import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../components/common/AppScreen';
import { ProgressBar } from '../components/common/ProgressBar';
import { ScreenTitleRow } from '../components/common/ScreenTitleRow';
import { SectionCard } from '../components/common/SectionCard';
import { ProgressionHeader } from '../components/progression/ProgressionHeader';
import { ACHIEVEMENTS_PER_MAP, MAP_IDS } from '../engine/achievements/mapDefinitions';
import { useAchievementStore } from '../stores/achievementStore';
import { useModeStatsStore } from '../stores/modeStatsStore';
import { colors, fontSizes, fontWeights, spacing } from '../theme';
import { formatChips } from '../utils/format';

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AchievementsScreen() {
  const router = useRouter();
  const lifetime = useAchievementStore((state) => state.stats);
  const mapSlices = useAchievementStore((state) => state.mapSlices);
  const regular = useModeStatsStore((state) => state.regular);
  const quiz = useModeStatsStore((state) => state.quiz);

  const totalUnlocked = MAP_IDS.reduce(
    (sum, mapId) => sum + (mapSlices[mapId]?.unlockedIds.length ?? 0),
    0,
  );
  const totalAchievements = MAP_IDS.length * ACHIEVEMENTS_PER_MAP;

  const quizAccuracy =
    quiz.questionsAnswered > 0
      ? `${Math.round((quiz.questionsCorrect / quiz.questionsAnswered) * 100)}%`
      : '—';

  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="Statistics" />
      <View style={styles.stack}>
        <SectionCard>
          <Text style={styles.sectionTitle}>Lifetime</Text>
          <View style={styles.statGrid}>
            <StatCell label="Hands" value={lifetime.handsPlayed} />
            <StatCell label="Wins" value={lifetime.wins} />
            <StatCell label="Blackjacks" value={lifetime.blackjacks} />
            <StatCell label="Best streak" value={lifetime.bestWinStreak} />
            <StatCell label="Splits" value={lifetime.splits} />
            <StatCell label="Doubles" value={lifetime.doubles} />
          </View>
        </SectionCard>
        <SectionCard>
          <Text style={styles.sectionTitle}>Regular Mode</Text>
          <View style={styles.statGrid}>
            <StatCell label="Hands" value={regular.handsPlayed} />
            <StatCell label="Wins" value={regular.wins} />
            <StatCell label="Losses" value={regular.losses} />
            <StatCell label="Pushes" value={regular.pushes} />
            <StatCell label="Blackjacks" value={regular.blackjacks} />
            <StatCell
              label="Net chips"
              value={`${regular.netChips >= 0 ? '+' : '−'}${formatChips(Math.abs(regular.netChips))}`}
            />
          </View>
        </SectionCard>
        <SectionCard>
          <Text style={styles.sectionTitle}>Quiz Mode</Text>
          <View style={styles.statGrid}>
            <StatCell label="Questions" value={quiz.questionsAnswered} />
            <StatCell label="Correct" value={quiz.questionsCorrect} />
            <StatCell label="Accuracy" value={quizAccuracy} />
            <StatCell label="Best streak" value={quiz.bestStreak} />
            <StatCell label="9-streaks" value={quiz.cyclesCompleted} />
            <StatCell label="Chips won" value={formatChips(quiz.chipsEarned)} />
          </View>
        </SectionCard>
      </View>

      <ScreenTitleRow title="Achievements" />
      <SectionCard>
        <Text style={styles.sectionTitle}>Casino Trophies</Text>
        <Text style={styles.achievementSummary}>
          {totalUnlocked} of {totalAchievements} unlocked across all tables.
        </Text>
        <ProgressBar
          progress={totalAchievements > 0 ? totalUnlocked / totalAchievements : 0}
          height={6}
          fillColor={colors.gold}
          accessibilityLabel={`${totalUnlocked} of ${totalAchievements} achievements`}
        />
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Open profile achievements">
          <Text style={styles.profileLink}>View achievements by casino →</Text>
        </Pressable>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    marginBottom: spacing.md,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    width: '33.3%',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.md,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
  },
  achievementSummary: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.md,
  },
  profileLink: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
});
