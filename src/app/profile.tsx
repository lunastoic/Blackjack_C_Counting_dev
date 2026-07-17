import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MAP_ART } from '../assets/registry';
import { AppScreen } from '../components/common/AppScreen';
import { ProgressBar } from '../components/common/ProgressBar';
import { ScreenTitleRow } from '../components/common/ScreenTitleRow';
import { SectionCard } from '../components/common/SectionCard';
import { ProgressionHeader } from '../components/progression/ProgressionHeader';
import { CASINO_MAPS } from '../engine/betting/casino';
import { ACHIEVEMENTS_PER_MAP, MAP_IDS } from '../engine/achievements/mapDefinitions';
import { useAchievementStore } from '../stores/achievementStore';
import { useProfileStore } from '../stores/profileStore';
import { useProgressionStore } from '../stores/progressionStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';

export default function ProfileScreen() {
  const router = useRouter();
  const displayName = useProfileStore((state) => state.displayName);
  const level = useProgressionStore((state) => state.level);
  const mapSlices = useAchievementStore((state) => state.mapSlices);
  const [selectedMapId, setSelectedMapId] = useState(MAP_IDS[0]);

  const totalUnlocked = useMemo(
    () => MAP_IDS.reduce((sum, mapId) => sum + (mapSlices[mapId]?.unlockedIds.length ?? 0), 0),
    [mapSlices],
  );
  const mapSummaries = useMemo(
    () =>
      MAP_IDS.map((mapId) => ({
        mapId,
        unlocked: mapSlices[mapId]?.unlockedIds.length ?? 0,
        total: ACHIEVEMENTS_PER_MAP,
      })),
    [mapSlices],
  );
  const progressList = useMemo(
    () => useAchievementStore.getState().progressList(selectedMapId),
    [mapSlices, selectedMapId],
  );
  const selectedMap = CASINO_MAPS.find((map) => map.id === selectedMapId);
  const selectedSummary = mapSummaries.find((item) => item.mapId === selectedMapId);
  const totalAchievements = MAP_IDS.length * ACHIEVEMENTS_PER_MAP;

  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="Profile" />
      <SectionCard>
        <Text style={styles.playerName}>{displayName}</Text>
        <Text style={styles.playerMeta}>
          Level {level} · {totalUnlocked} / {totalAchievements} achievements unlocked
        </Text>
        <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Edit player settings">
          <Text style={styles.editLink}>Edit name & settings</Text>
        </Pressable>
      </SectionCard>

      <ScreenTitleRow title="Casino Achievements" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mapPicker}
      >
        {CASINO_MAPS.map((map) => {
          const summary = mapSummaries.find((item) => item.mapId === map.id);
          const active = map.id === selectedMapId;
          return (
            <Pressable
              key={map.id}
              onPress={() => setSelectedMapId(map.id)}
              accessibilityLabel={`${map.name}, ${summary?.unlocked ?? 0} of ${summary?.total ?? ACHIEVEMENTS_PER_MAP} achievements`}
              style={[styles.mapChip, active && styles.mapChipActive]}
            >
              <Image source={MAP_ART[map.artKey]} style={styles.mapThumb} resizeMode="cover" />
              <Text style={[styles.mapChipText, active && styles.mapChipTextActive]} numberOfLines={1}>
                {map.name.split(' ')[0]}
              </Text>
              <Text style={styles.mapChipProgress}>
                {summary?.unlocked ?? 0}/{summary?.total ?? ACHIEVEMENTS_PER_MAP}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedMap && selectedSummary ? (
        <SectionCard>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>{selectedMap.name}</Text>
            <Text style={styles.mapProgress}>
              {selectedSummary.unlocked} / {selectedSummary.total} complete
            </Text>
          </View>
          <ProgressBar
            progress={selectedSummary.total > 0 ? selectedSummary.unlocked / selectedSummary.total : 0}
            height={6}
            fillColor={colors.gold}
            accessibilityLabel={`${selectedSummary.unlocked} of ${selectedSummary.total} achievements`}
          />
        </SectionCard>
      ) : null}

      <View style={styles.achievementList}>
        {progressList.map(({ definition, progress }) => (
          <SectionCard
            key={definition.id}
            style={progress.unlocked ? styles.unlockedCard : styles.lockedCard}
          >
            <View style={styles.achievementHeader}>
              <Text
                style={[styles.achievementTitle, progress.unlocked && styles.achievementTitleUnlocked]}
                numberOfLines={1}
              >
                {definition.title}
              </Text>
              <Text style={progress.unlocked ? styles.unlockedBadge : styles.lockedBadge}>
                {progress.unlocked ? 'DONE' : 'LEFT'}
              </Text>
            </View>
            <Text style={styles.achievementDescription}>{definition.description}</Text>
            <View style={styles.progressRow}>
              <ProgressBar
                progress={progress.goal > 0 ? progress.current / progress.goal : 0}
                height={5}
                fillColor={progress.unlocked ? colors.success : colors.gold}
                accessibilityLabel={`${progress.current} of ${progress.goal}`}
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                {progress.current}/{progress.goal}
              </Text>
            </View>
          </SectionCard>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  playerName: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
    marginBottom: spacing.xs,
  },
  playerMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.sm,
  },
  editLink: {
    color: colors.gold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
  },
  mapPicker: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  mapChip: {
    width: 88,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  mapChipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.overlayLight,
  },
  mapThumb: {
    width: 56,
    height: 36,
    borderRadius: radii.sm,
  },
  mapChipText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
  },
  mapChipTextActive: {
    color: colors.goldBright,
  },
  mapChipProgress: {
    color: colors.textMuted,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  mapTitle: {
    flex: 1,
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  mapProgress: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontVariant: ['tabular-nums'],
  },
  achievementList: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  unlockedCard: {
    borderColor: colors.success,
  },
  lockedCard: {
    opacity: 0.92,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  achievementTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  achievementTitleUnlocked: {
    color: colors.goldBright,
  },
  unlockedBadge: {
    color: colors.success,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  lockedBadge: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  achievementDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontVariant: ['tabular-nums'],
  },
});
