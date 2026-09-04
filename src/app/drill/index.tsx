import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/common/AppScreen';
import { ScreenTitleRow } from '../../components/common/ScreenTitleRow';
import { ProgressionHeader } from '../../components/progression/ProgressionHeader';
import { DojoButton } from '../../components/dojo/DojoButton';
import { useDojoStore } from '../../stores/dojoStore';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

const DRILLS = [
  {
    id: 'values',
    title: 'Value Flash',
    subtitle: 'Tap +1, 0, or −1 as fast as you can for 20 cards.',
    route: '/drill/values',
  },
  {
    id: 'running',
    title: 'Running Count',
    subtitle: 'Deal cards one by one and keep the running count.',
    route: '/drill/running',
  },
  {
    id: 'speed',
    title: 'Speed Count',
    subtitle: 'Cards flash quickly — call the running count.',
    route: '/drill/speed',
  },
] as const;

export default function DrillIndexScreen() {
  const router = useRouter();
  const drillBests = useDojoStore((state) => state.drillBests);

  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="Drills" />
      <Text style={styles.intro}>
        Drills isolate the skills you need at the table. Accuracy first — speed comes with
        repetition.
      </Text>
      <View style={styles.list}>
        {DRILLS.map((drill) => {
          const best = drillBests[drill.id];
          return (
            <View key={drill.id} style={styles.card}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>{drill.title}</Text>
                  <Text style={styles.subtitle}>{drill.subtitle}</Text>
                </View>
                {best ? (
                  <View style={styles.best}>
                    <Text style={styles.bestLabel}>BEST</Text>
                    <Text style={styles.bestValue}>{Math.round(best.accuracy * 100)}%</Text>
                  </View>
                ) : null}
              </View>
              <DojoButton label="Start Drill" variant="secondary" onPress={() => router.push(drill.route)} />
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
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    marginTop: spacing.xs,
  },
  best: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bestLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
  },
  bestValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
  },
});
